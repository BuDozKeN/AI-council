"""
LLM Operations Router

Endpoints for LLM usage analytics, rate limits, and budget management:
- Usage analytics (daily breakdown, model costs)
- Rate limit configuration
- Budget alerts
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
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

    # Get parse failure stats
    parse_failures = 0
    try:
        pf_result = client.table("parse_failures").select(
            "id", count="exact"
        ).eq("company_id", company_uuid).gte(
            "created_at", f"now() - interval '{days} days'"
        ).execute()
        parse_failures = pf_result.count or 0
    except Exception:
        pass  # Table might not exist yet (migration pending)

    # Calculate parse success rate
    # Estimate total rankings: council_sessions * 6 (6 Stage 2 reviewers per session)
    total_rankings = total_council_sessions * 6
    parse_success_rate = (
        ((total_rankings - parse_failures) / total_rankings * 100)
        if total_rankings > 0 else 100.0
    )

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
            'parse_success_rate': round(parse_success_rate, 1),
            'parse_failures': parse_failures,
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


# =============================================================================
# LLM HUB - PRESETS & MODEL REGISTRY
# =============================================================================
# Admin-only endpoints for managing LLM configuration:
# - View/edit system presets (temperature, max_tokens per stage)
# - View/edit model registry (which models are used for each role)

class StageConfig(BaseModel):
    """LLM configuration for a single stage."""
    temperature: float = Field(ge=0.0, le=1.2)
    max_tokens: int = Field(ge=256, le=16384)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class PresetConfig(BaseModel):
    """Full preset configuration with all 3 stages."""
    stage1: StageConfig
    stage2: StageConfig
    stage3: StageConfig


class UpdatePreset(BaseModel):
    """Update a preset's configuration."""
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[PresetConfig] = None


class ModelRegistryEntry(BaseModel):
    """A single model registry entry."""
    id: str
    role: str
    model_id: str
    display_name: Optional[str] = None
    priority: int
    is_active: bool
    notes: Optional[str] = None


class UpdateModelRegistry(BaseModel):
    """Update a model registry entry."""
    model_id: Optional[str] = None
    display_name: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CreateModelRegistry(BaseModel):
    """Create a new model registry entry."""
    role: str = Field(..., min_length=1, max_length=50)
    model_id: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = None
    priority: int = Field(default=0, ge=0)
    notes: Optional[str] = None


@router.get("/{company_id}/llm-hub/presets")
async def get_llm_presets(
    company_id: ValidCompanyId,
    user: dict = Depends(get_current_user)
):
    """
    Get all LLM presets (system-wide).

    Returns conservative, balanced, creative presets with their configs.
    Only accessible by company owners.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    # Verify owner access for LLM Hub
    verify_owner_access(client, company_uuid, user)

    # Get all presets
    result = client.table("llm_presets") \
        .select("*") \
        .eq("is_active", True) \
        .order("id") \
        .execute()

    presets = [
        {
            'id': p['id'],
            'name': p['name'],
            'description': p.get('description'),
            'config': p['config'],
            'recommended_for': p.get('recommended_for', []),
            'updated_at': p.get('updated_at'),
        }
        for p in (result.data or [])
    ]

    return {'presets': presets}


@router.put("/{company_id}/llm-hub/presets/{preset_id}")
async def update_llm_preset(
    company_id: ValidCompanyId,
    preset_id: str,
    body: UpdatePreset,
    user: dict = Depends(get_current_user)
):
    """
    Update an LLM preset configuration.

    Only company owners can modify presets.
    Valid preset_ids: conservative, balanced, creative
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    # Validate preset_id
    valid_presets = {'conservative', 'balanced', 'creative'}
    if preset_id not in valid_presets:
        raise HTTPException(status_code=400, detail=f"Invalid preset_id. Must be one of: {valid_presets}")

    # Build update data
    update_data: Dict[str, Any] = {'updated_at': datetime.now().isoformat()}

    if body.name is not None:
        update_data['name'] = body.name
    if body.description is not None:
        update_data['description'] = body.description
    if body.config is not None:
        update_data['config'] = {
            'stage1': body.config.stage1.model_dump(exclude_none=True),
            'stage2': body.config.stage2.model_dump(exclude_none=True),
            'stage3': body.config.stage3.model_dump(exclude_none=True),
        }

    if len(update_data) == 1:  # Only updated_at
        raise HTTPException(status_code=400, detail="No updates provided")

    try:
        result = client.table("llm_presets") \
            .update(update_data) \
            .eq("id", preset_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Preset not found")

        log_app_event(
            "LLM_PRESET_UPDATED",
            level="INFO",
            company_id=company_uuid,
            preset_id=preset_id,
            updates=list(update_data.keys())
        )

        return {'success': True, 'preset': result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        log_app_event("LLM_PRESET_UPDATE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update preset")


# Consolidated roles for LLM Hub
# Old roles are deprecated and aliased in the backend
CONSOLIDATED_ROLES = [
    'council_member',    # Core - parallel queries
    'stage2_reviewer',   # Core - parallel queries
    'chairman',          # Core - synthesis
    'document_writer',   # Document writing (replaces sop_writer, framework_author, etc.)
    'utility',           # Helper tools (replaces title_generator, triage, sarah, etc.)
]


@router.get("/{company_id}/llm-hub/models")
async def get_model_registry(
    company_id: ValidCompanyId,
    role: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    Get model registry entries.

    Returns all models organized by role.
    Only returns CONSOLIDATED_ROLES (council_member, chairman, document_writer, utility).
    Old roles (sop_writer, title_generator, etc.) are deprecated and aliased in backend.
    Always returns ALL consolidated roles in the 'roles' list, even if they have no models yet.
    Only accessible by company owners.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    # Build query - get global models (company_id IS NULL) and company-specific
    # Only fetch consolidated roles
    query = client.table("model_registry") \
        .select("*") \
        .in_("role", CONSOLIDATED_ROLES) \
        .eq("is_active", True) \
        .order("role") \
        .order("priority")

    if role:
        query = query.eq("role", role)

    # Filter: company_id is null (global) OR matches this company
    # Note: Supabase doesn't support OR in Python SDK easily, so we get all and filter
    result = query.execute()

    # Filter to global + this company's overrides
    models = [
        m for m in (result.data or [])
        if m.get('company_id') is None or m.get('company_id') == company_uuid
    ]

    # Organize by role
    by_role: Dict[str, List[Dict]] = {}
    for m in models:
        r = m['role']
        if r not in by_role:
            by_role[r] = []
        by_role[r].append({
            'id': m['id'],
            'role': m['role'],
            'model_id': m['model_id'],
            'display_name': m.get('display_name'),
            'priority': m['priority'],
            'is_active': m['is_active'],
            'is_global': m.get('company_id') is None,
            'notes': m.get('notes'),
        })

    # Always return ALL consolidated roles, even if they have no models yet
    # This allows the UI to show empty groups with "Add" button
    return {
        'models': by_role,
        'roles': CONSOLIDATED_ROLES,
    }


@router.put("/{company_id}/llm-hub/models/{model_uuid}")
async def update_model_registry_entry(
    company_id: ValidCompanyId,
    model_uuid: str,
    body: UpdateModelRegistry,
    user: dict = Depends(get_current_user)
):
    """
    Update a model registry entry.

    For global models, this creates a company-specific override.
    Only company owners can modify models.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    # Get existing model
    existing = client.table("model_registry") \
        .select("*") \
        .eq("id", model_uuid) \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Model not found")

    model = existing.data[0]

    # Build update data
    update_data: Dict[str, Any] = {'updated_at': datetime.now().isoformat()}

    if body.model_id is not None:
        update_data['model_id'] = body.model_id
    if body.display_name is not None:
        update_data['display_name'] = body.display_name
    if body.priority is not None:
        update_data['priority'] = body.priority
    if body.is_active is not None:
        update_data['is_active'] = body.is_active
    if body.notes is not None:
        update_data['notes'] = body.notes

    if len(update_data) == 1:  # Only updated_at
        raise HTTPException(status_code=400, detail="No updates provided")

    try:
        # If it's a global model, we update directly (for owner's system)
        # In future: could create company-specific override instead
        result = client.table("model_registry") \
            .update(update_data) \
            .eq("id", model_uuid) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Model not found")

        log_app_event(
            "MODEL_REGISTRY_UPDATED",
            level="INFO",
            company_id=company_uuid,
            model_id=model_uuid,
            updates=list(update_data.keys())
        )

        return {'success': True, 'model': result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        log_app_event("MODEL_REGISTRY_UPDATE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update model")


@router.post("/{company_id}/llm-hub/models")
async def create_model_registry_entry(
    company_id: ValidCompanyId,
    body: CreateModelRegistry,
    user: dict = Depends(get_current_user)
):
    """
    Create a new model registry entry.

    This creates a global model (company_id = NULL).
    Only company owners can create models.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    try:
        result = client.table("model_registry").insert({
            'role': body.role,
            'model_id': body.model_id,
            'display_name': body.display_name,
            'priority': body.priority,
            'is_active': True,
            'notes': body.notes,
            # company_id = NULL means global
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create model")

        log_app_event(
            "MODEL_REGISTRY_CREATED",
            level="INFO",
            company_id=company_uuid,
            role=body.role,
            model_id=body.model_id
        )

        return {'success': True, 'model': result.data[0]}
    except Exception as e:
        if 'unique' in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="A model with this role and priority already exists"
            )
        log_app_event("MODEL_REGISTRY_CREATE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create model")


@router.delete("/{company_id}/llm-hub/models/{model_uuid}")
async def delete_model_registry_entry(
    company_id: ValidCompanyId,
    model_uuid: str,
    user: dict = Depends(get_current_user)
):
    """
    Delete a model registry entry.

    Only company owners can delete models.
    Warning: This permanently removes the model from the registry.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    try:
        # Get model info for logging before delete
        existing = client.table("model_registry") \
            .select("role, model_id") \
            .eq("id", model_uuid) \
            .execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Model not found")

        model_info = existing.data[0]

        # Delete
        client.table("model_registry") \
            .delete() \
            .eq("id", model_uuid) \
            .execute()

        log_app_event(
            "MODEL_REGISTRY_DELETED",
            level="WARN",
            company_id=company_uuid,
            model_uuid=model_uuid,
            role=model_info.get('role'),
            model_id=model_info.get('model_id')
        )

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        log_app_event("MODEL_REGISTRY_DELETE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete model")


# =============================================================================
# AI PERSONAS - Prompt Management
# =============================================================================
# Endpoints for viewing and editing AI personas (the prompts that define expertise).
# Personas are stored in the ai_personas table and define how each document type
# or utility behaves. The LLM model is just the engine; the persona is the expertise.

# Personas available for editing in LLM Hub
EDITABLE_PERSONAS = [
    'sop_writer',           # SOP writing expertise
    'framework_author',     # Framework design expertise
    'policy_writer',        # Policy writing expertise
    'persona_architect',    # AI advisor system prompt designer
    'sarah',                # Project management persona
    'ai_write_assist',      # General writing assistance
]


class PersonaResponse(BaseModel):
    """A persona returned from the API."""
    id: str
    persona_key: str
    name: str
    category: str
    description: Optional[str] = None
    system_prompt: str
    user_prompt_template: Optional[str] = None
    is_global: bool = True
    updated_at: Optional[str] = None


class UpdatePersona(BaseModel):
    """Update a persona's prompts."""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt_template: Optional[str] = None


@router.get("/{company_id}/llm-hub/personas")
async def get_personas(
    company_id: ValidCompanyId,
    user: dict = Depends(get_current_user)
):
    """
    Get all editable AI personas for the LLM Hub.

    Returns personas that can be customized (sop_writer, framework_author, etc.).
    Only accessible by company owners.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    # Get global personas that are editable
    result = client.table("ai_personas") \
        .select("*") \
        .in_("persona_key", EDITABLE_PERSONAS) \
        .is_("company_id", "null") \
        .eq("is_active", True) \
        .order("persona_key") \
        .execute()

    # Also check for company-specific overrides
    company_result = client.table("ai_personas") \
        .select("*") \
        .in_("persona_key", EDITABLE_PERSONAS) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .execute()

    # Merge: company-specific overrides take precedence
    company_personas = {p['persona_key']: p for p in (company_result.data or [])}

    personas = []
    for p in (result.data or []):
        # Skip global if there's a company override
        if p['persona_key'] in company_personas:
            continue
        personas.append({
            'id': p['id'],
            'persona_key': p['persona_key'],
            'name': p['name'],
            'category': p.get('category', 'general'),
            'description': p.get('description'),
            'system_prompt': p['system_prompt'],
            'user_prompt_template': p.get('user_prompt_template'),
            'is_global': True,
            'updated_at': p.get('updated_at'),
        })

    # Add company-specific personas
    for p in company_personas.values():
        personas.append({
            'id': p['id'],
            'persona_key': p['persona_key'],
            'name': p['name'],
            'category': p.get('category', 'general'),
            'description': p.get('description'),
            'system_prompt': p['system_prompt'],
            'user_prompt_template': p.get('user_prompt_template'),
            'is_global': False,
            'updated_at': p.get('updated_at'),
        })

    # Sort by persona_key for consistent ordering
    personas.sort(key=lambda x: EDITABLE_PERSONAS.index(x['persona_key']) if x['persona_key'] in EDITABLE_PERSONAS else 99)

    return {'personas': personas}


@router.get("/{company_id}/llm-hub/personas/{persona_key}")
async def get_persona(
    company_id: ValidCompanyId,
    persona_key: str,
    user: dict = Depends(get_current_user)
):
    """
    Get a single persona by key.

    Returns company-specific override if it exists, otherwise global.
    Only accessible by company owners.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    if persona_key not in EDITABLE_PERSONAS:
        raise HTTPException(status_code=400, detail="Persona not editable")

    # Try company-specific first
    company_result = client.table("ai_personas") \
        .select("*") \
        .eq("persona_key", persona_key) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .execute()

    if company_result.data:
        p = company_result.data[0]
        return {
            'persona': {
                'id': p['id'],
                'persona_key': p['persona_key'],
                'name': p['name'],
                'category': p.get('category', 'general'),
                'description': p.get('description'),
                'system_prompt': p['system_prompt'],
                'user_prompt_template': p.get('user_prompt_template'),
                'is_global': False,
                'updated_at': p.get('updated_at'),
            }
        }

    # Fall back to global
    global_result = client.table("ai_personas") \
        .select("*") \
        .eq("persona_key", persona_key) \
        .is_("company_id", "null") \
        .eq("is_active", True) \
        .execute()

    if not global_result.data:
        raise HTTPException(status_code=404, detail="Persona not found")

    p = global_result.data[0]
    return {
        'persona': {
            'id': p['id'],
            'persona_key': p['persona_key'],
            'name': p['name'],
            'category': p.get('category', 'general'),
            'description': p.get('description'),
            'system_prompt': p['system_prompt'],
            'user_prompt_template': p.get('user_prompt_template'),
            'is_global': True,
            'updated_at': p.get('updated_at'),
        }
    }


@router.put("/{company_id}/llm-hub/personas/{persona_key}")
async def update_persona(
    company_id: ValidCompanyId,
    persona_key: str,
    body: UpdatePersona,
    user: dict = Depends(get_current_user)
):
    """
    Update a persona's prompts.

    If the persona is global, creates a company-specific override.
    If already company-specific, updates it directly.
    Only company owners can modify personas.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    if persona_key not in EDITABLE_PERSONAS:
        raise HTTPException(status_code=400, detail="Persona not editable")

    # Build update data
    update_data: Dict[str, Any] = {'updated_at': datetime.now().isoformat()}

    if body.name is not None:
        update_data['name'] = body.name
    if body.description is not None:
        update_data['description'] = body.description
    if body.system_prompt is not None:
        update_data['system_prompt'] = body.system_prompt
    if body.user_prompt_template is not None:
        update_data['user_prompt_template'] = body.user_prompt_template

    if len(update_data) == 1:  # Only updated_at
        raise HTTPException(status_code=400, detail="No updates provided")

    try:
        # Check if company-specific override exists
        existing = client.table("ai_personas") \
            .select("*") \
            .eq("persona_key", persona_key) \
            .eq("company_id", company_uuid) \
            .execute()

        if existing.data:
            # Update existing company override
            result = client.table("ai_personas") \
                .update(update_data) \
                .eq("id", existing.data[0]['id']) \
                .execute()

            log_app_event(
                "PERSONA_UPDATED",
                level="INFO",
                company_id=company_uuid,
                persona_key=persona_key,
                updates=list(update_data.keys())
            )

            return {'success': True, 'persona': result.data[0], 'created': False}
        else:
            # Create company-specific override from global
            global_persona = client.table("ai_personas") \
                .select("*") \
                .eq("persona_key", persona_key) \
                .is_("company_id", "null") \
                .eq("is_active", True) \
                .single() \
                .execute()

            if not global_persona.data:
                raise HTTPException(status_code=404, detail="Global persona not found")

            # Create new company-specific persona
            new_persona = {
                'persona_key': persona_key,
                'name': update_data.get('name', global_persona.data['name']),
                'category': global_persona.data.get('category', 'general'),
                'description': update_data.get('description', global_persona.data.get('description')),
                'system_prompt': update_data.get('system_prompt', global_persona.data['system_prompt']),
                'user_prompt_template': update_data.get('user_prompt_template', global_persona.data.get('user_prompt_template')),
                'company_id': company_uuid,
                'is_active': True,
            }

            result = client.table("ai_personas").insert(new_persona).execute()

            log_app_event(
                "PERSONA_OVERRIDE_CREATED",
                level="INFO",
                company_id=company_uuid,
                persona_key=persona_key,
                updates=list(update_data.keys())
            )

            return {'success': True, 'persona': result.data[0], 'created': True}

    except HTTPException:
        raise
    except Exception as e:
        log_app_event("PERSONA_UPDATE_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update persona")


@router.delete("/{company_id}/llm-hub/personas/{persona_key}/reset")
async def reset_persona(
    company_id: ValidCompanyId,
    persona_key: str,
    user: dict = Depends(get_current_user)
):
    """
    Reset a persona to global defaults.

    Deletes the company-specific override, reverting to the global persona.
    Only company owners can reset personas.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Company not found")

    verify_owner_access(client, company_uuid, user)

    if persona_key not in EDITABLE_PERSONAS:
        raise HTTPException(status_code=400, detail="Persona not editable")

    try:
        # Delete company-specific override
        result = client.table("ai_personas") \
            .delete() \
            .eq("persona_key", persona_key) \
            .eq("company_id", company_uuid) \
            .execute()

        if result.data:
            log_app_event(
                "PERSONA_RESET",
                level="INFO",
                company_id=company_uuid,
                persona_key=persona_key
            )
            return {'success': True, 'message': 'Reset to global defaults'}
        else:
            return {'success': True, 'message': 'Already using global defaults'}

    except Exception as e:
        log_app_event("PERSONA_RESET_FAILED", level="ERROR", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to reset persona")
