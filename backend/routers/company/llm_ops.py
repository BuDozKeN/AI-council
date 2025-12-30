"""
LLM Operations Router

Endpoints for LLM usage analytics, rate limits, and budget management:
- Usage analytics (daily breakdown, model costs)
- Rate limit configuration
- Budget alerts
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from ...auth import get_current_user
from .utils import (
    get_service_client,
    verify_company_access,
    resolve_company_id,
    ValidCompanyId,
    get_usage_analytics,
    get_rate_limit_config,
    check_rate_limits,
)
from ...security import log_app_event


router = APIRouter(prefix="/company", tags=["llm-ops"])


# =============================================================================
# ACCESS HELPERS
# =============================================================================

def verify_admin_access(client, company_uuid: str, user: dict) -> dict:
    """
    Verify user is owner or admin of the company.
    Returns company data if access is granted.
    """
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # First verify basic access
    verify_company_access(client, company_uuid, user)

    # Check if user is owner
    owner_result = client.table("companies") \
        .select("*") \
        .eq("id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if owner_result.data:
        return owner_result.data[0]

    # Check if user is admin via company_members
    member_result = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if member_result.data:
        role = member_result.data[0].get('role')
        if role in ('owner', 'admin'):
            company = client.table("companies").select("*").eq("id", company_uuid).single().execute()
            return company.data

    raise HTTPException(status_code=403, detail="Admin access required")


def verify_owner_access(client, company_uuid: str, user: dict) -> dict:
    """
    Verify user is owner of the company.
    Returns company data if access is granted.
    """
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # Check if user owns the company
    result = client.table("companies") \
        .select("*") \
        .eq("id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if result.data:
        return result.data[0]

    raise HTTPException(status_code=403, detail="Owner access required")


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class UsageSummary(BaseModel):
    """Summary of token usage."""
    total_sessions: int = 0
    total_tokens: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_read_tokens: int = 0
    estimated_cost_cents: int = 0
    avg_tokens_per_session: float = 0
    cache_hit_rate: float = 0


class DailyUsage(BaseModel):
    """Daily usage breakdown."""
    date: str
    sessions: int
    tokens_input: int
    tokens_output: int
    tokens_total: int
    cache_read_tokens: int
    estimated_cost_cents: int


class ModelUsage(BaseModel):
    """Usage per model."""
    model: str
    sessions: int
    tokens_input: int
    tokens_output: int
    cost_cents: int


class RateLimitStatus(BaseModel):
    """Current rate limit status."""
    tier: str
    sessions_hourly: int
    sessions_hourly_limit: int
    sessions_daily: int
    sessions_daily_limit: int
    tokens_monthly: int
    tokens_monthly_limit: int
    budget_monthly_cents: int
    budget_monthly_limit_cents: int
    warnings: List[str] = []


class BudgetAlert(BaseModel):
    """Budget alert."""
    id: str
    alert_type: str
    current_value: int
    limit_value: int
    created_at: str
    acknowledged: bool


class UpdateRateLimits(BaseModel):
    """Update rate limit configuration."""
    sessions_per_hour: Optional[int] = None
    sessions_per_day: Optional[int] = None
    tokens_per_month: Optional[int] = None
    budget_cents_per_month: Optional[int] = None
    alert_threshold_percent: Optional[int] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/llm-ops/usage")
async def get_llm_usage(
    company_id: ValidCompanyId,
    days: int = Query(default=30, ge=1, le=90),
    user: dict = Depends(get_current_user)
):
    """
    Get LLM usage analytics for the dashboard.

    Returns daily usage breakdown, model usage, and summary statistics.
    Only accessible by company owners and admins.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    # Verify admin access
    verify_admin_access(client, company_uuid, user)

    # Get daily usage analytics
    daily_data = await get_usage_analytics(company_uuid, days)

    # Calculate summary
    total_sessions = 0
    total_input = 0
    total_output = 0
    total_tokens = 0
    total_cache_read = 0
    total_cost = 0
    model_usage = {}
    # Breakdown by session type
    total_council_sessions = 0
    total_council_cost = 0
    total_internal_sessions = 0
    total_internal_cost = 0

    for day in daily_data:
        total_sessions += day.get('sessions', 0)
        total_input += day.get('tokens_input', 0) or 0
        total_output += day.get('tokens_output', 0) or 0
        total_tokens += day.get('tokens_total', 0) or 0
        total_cache_read += day.get('cache_read_tokens', 0) or 0
        total_cost += day.get('estimated_cost_cents', 0) or 0
        # Session type breakdown
        total_council_sessions += day.get('council_sessions', 0) or 0
        total_council_cost += day.get('council_cost_cents', 0) or 0
        total_internal_sessions += day.get('internal_sessions', 0) or 0
        total_internal_cost += day.get('internal_cost_cents', 0) or 0

        # Aggregate model usage from top_models
        top_models = day.get('top_models') or []
        for model_data in top_models:
            if isinstance(model_data, dict):
                for model, usage in model_data.items():
                    if model not in model_usage:
                        model_usage[model] = {'input': 0, 'output': 0, 'cost_cents': 0, 'sessions': 0}
                    model_usage[model]['input'] += usage.get('input', 0)
                    model_usage[model]['output'] += usage.get('output', 0)
                    model_usage[model]['cost_cents'] += usage.get('cost_cents', 0)
                    model_usage[model]['sessions'] += 1

    # Format daily data
    daily = [
        {
            'date': str(day.get('date', '')),
            'sessions': day.get('sessions', 0),
            'tokens_input': day.get('tokens_input', 0) or 0,
            'tokens_output': day.get('tokens_output', 0) or 0,
            'tokens_total': day.get('tokens_total', 0) or 0,
            'cache_read_tokens': day.get('cache_read_tokens', 0) or 0,
            'estimated_cost_cents': day.get('estimated_cost_cents', 0) or 0,
            # Session type breakdown per day
            'council_sessions': day.get('council_sessions', 0) or 0,
            'council_cost_cents': day.get('council_cost_cents', 0) or 0,
            'internal_sessions': day.get('internal_sessions', 0) or 0,
            'internal_cost_cents': day.get('internal_cost_cents', 0) or 0,
        }
        for day in daily_data
    ]

    # Format model usage
    models = [
        {
            'model': model,
            'sessions': usage['sessions'],
            'tokens_input': usage['input'],
            'tokens_output': usage['output'],
            'cost_cents': usage['cost_cents'],
        }
        for model, usage in sorted(model_usage.items(), key=lambda x: x[1]['cost_cents'], reverse=True)
    ]

    # Calculate rates
    avg_tokens = total_tokens / total_sessions if total_sessions > 0 else 0
    cache_hit_rate = (total_cache_read / total_input * 100) if total_input > 0 else 0

    return {
        'summary': {
            'total_sessions': total_sessions,
            'total_tokens': total_tokens,
            'total_input_tokens': total_input,
            'total_output_tokens': total_output,
            'total_cache_read_tokens': total_cache_read,
            'estimated_cost_cents': total_cost,
            'avg_tokens_per_session': round(avg_tokens, 0),
            'cache_hit_rate': round(cache_hit_rate, 1),
            # Breakdown by session type
            'council_sessions': total_council_sessions,
            'council_cost_cents': total_council_cost,
            'internal_sessions': total_internal_sessions,
            'internal_cost_cents': total_internal_cost,
        },
        'daily': daily,
        'models': models,
        'period_days': days,
    }


@router.get("/{company_id}/llm-ops/rate-limits")
async def get_rate_limit_status(
    company_id: ValidCompanyId,
    user: dict = Depends(get_current_user)
):
    """
    Get current rate limit status and configuration.

    Returns current usage vs limits for sessions, tokens, and budget.
    Only accessible by company owners and admins.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_admin_access(client, company_uuid, user)

    # Get rate limit config
    config = await get_rate_limit_config(company_uuid)

    # Get current status
    status = await check_rate_limits(company_uuid)
    details = status.get('details', {})

    # Flatten the current values for frontend consumption
    current = {
        'sessions_hourly': details.get('sessions_hourly', {}).get('current', 0),
        'sessions_daily': details.get('sessions_daily', {}).get('current', 0),
        'tokens_monthly': details.get('tokens_monthly', {}).get('current', 0),
        'budget_monthly_cents': details.get('budget_monthly', {}).get('current', 0),
    }

    return {
        'tier': config.get('tier', 'free'),
        'config': {
            'sessions_per_hour': config.get('sessions_per_hour', 20),
            'sessions_per_day': config.get('sessions_per_day', 100),
            'tokens_per_month': config.get('tokens_per_month', 10_000_000),
            'budget_cents_per_month': config.get('budget_cents_per_month', 10_000),
            'alert_threshold_percent': config.get('alert_threshold_percent', 80),
        },
        'current': current,
        'warnings': status['warnings'],
        'exceeded': status['exceeded'],
    }


@router.put("/{company_id}/llm-ops/rate-limits")
async def update_rate_limits(
    company_id: ValidCompanyId,
    body: UpdateRateLimits,
    user: dict = Depends(get_current_user)
):
    """
    Update rate limit configuration.

    Only company owners can update rate limits.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    # Build update data (only include non-None values)
    update_data = {}
    if body.sessions_per_hour is not None:
        update_data['sessions_per_hour'] = body.sessions_per_hour
    if body.sessions_per_day is not None:
        update_data['sessions_per_day'] = body.sessions_per_day
    if body.tokens_per_month is not None:
        update_data['tokens_per_month'] = body.tokens_per_month
    if body.budget_cents_per_month is not None:
        update_data['budget_cents_per_month'] = body.budget_cents_per_month
    if body.alert_threshold_percent is not None:
        update_data['alert_threshold_percent'] = body.alert_threshold_percent

    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")

    update_data['updated_at'] = datetime.now().isoformat()

    try:
        # Upsert rate limits
        client.table('rate_limits').upsert({
            'company_id': company_uuid,
            **update_data
        }).execute()

        log_app_event(
            "RATE_LIMITS_UPDATED",
            level="INFO",
            company_id=company_uuid,
            updates=update_data
        )

        return {'success': True, 'updated': update_data}
    except Exception as e:
        log_app_event("RATE_LIMITS_UPDATE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update rate limits")


@router.get("/{company_id}/llm-ops/alerts")
async def get_budget_alerts(
    company_id: ValidCompanyId,
    acknowledged: Optional[bool] = None,
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """
    Get budget alerts for the company.

    Only accessible by company owners and admins.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_admin_access(client, company_uuid, user)

    query = client.table('budget_alerts') \
        .select('*') \
        .eq('company_id', company_uuid) \
        .order('created_at', desc=True) \
        .limit(limit)

    if acknowledged is not None:
        if acknowledged:
            query = query.not_.is_('acknowledged_at', 'null')
        else:
            query = query.is_('acknowledged_at', 'null')

    result = query.execute()

    alerts = [
        {
            'id': alert['id'],
            'alert_type': alert['alert_type'],
            'current_value': alert['current_value'],
            'limit_value': alert['limit_value'],
            'created_at': alert['created_at'],
            'acknowledged': alert.get('acknowledged_at') is not None,
            'acknowledged_at': alert.get('acknowledged_at'),
        }
        for alert in (result.data or [])
    ]

    return {'alerts': alerts, 'total': len(alerts)}


@router.post("/{company_id}/llm-ops/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    company_id: ValidCompanyId,
    alert_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Acknowledge a budget alert.

    Only accessible by company owners and admins.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_admin_access(client, company_uuid, user)

    user_id = user.get('id') if isinstance(user, dict) else user.id

    try:
        result = client.table('budget_alerts') \
            .update({
                'acknowledged_at': datetime.now().isoformat(),
                'acknowledged_by': user_id
            }) \
            .eq('id', alert_id) \
            .eq('company_id', company_uuid) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        log_app_event("ALERT_ACKNOWLEDGE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to acknowledge alert")
