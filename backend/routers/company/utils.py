"""
Company Router Utilities

Shared helpers, validators, and Pydantic models for company sub-routers.
"""

from fastapi import HTTPException, Path
from pydantic import BaseModel, field_validator
from typing import Optional, List, Annotated, Literal
from datetime import datetime
import re
import time
import json

from ...database import get_supabase_with_auth, get_supabase_service
from ...security import SecureHTTPException, log_app_event


# =============================================================================
# PATTERNS AND VALIDATORS
# =============================================================================

UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
SAFE_ID_PATTERN = r'^[a-zA-Z0-9_-]+$'

# Annotated types for validated path parameters
ValidCompanyId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Company ID (UUID or slug)")]
ValidDeptId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Department ID")]
ValidRoleId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Role ID")]
ValidPlaybookId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Playbook ID")]
ValidDecisionId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Decision ID")]
ValidProjectId = Annotated[str, Path(pattern=SAFE_ID_PATTERN, description="Project ID")]

# In-memory cache for company slug → UUID mapping (TTL: 5 minutes)
_company_uuid_cache = {}
_CACHE_TTL = 300  # 5 minutes


# =============================================================================
# CLIENT HELPERS
# =============================================================================

def get_client(user):
    """Get authenticated Supabase client."""
    if isinstance(user, dict):
        access_token = user.get('access_token')
    else:
        access_token = user.access_token
    return get_supabase_with_auth(access_token)


def get_service_client():
    """Get Supabase service client (bypasses RLS)."""
    client = get_supabase_service()
    if not client:
        raise HTTPException(status_code=500, detail="Service client not configured")
    return client


# =============================================================================
# ACCESS CONTROL
# =============================================================================

def verify_company_access(client, company_uuid: str, user: dict) -> bool:
    """
    Verify that the authenticated user has access to the specified company.

    Access is granted if:
    1. User owns the company (companies.user_id = user.id)
    2. User is a member of the company (company_members table)
    3. User has department access to the company (user_department_access table - legacy)
    """
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # Check if user owns the company
    owner_result = client.table("companies") \
        .select("id") \
        .eq("id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if owner_result.data:
        return True

    # Check if user is a member of this company
    member_result = client.table("company_members") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if member_result.data:
        return True

    # Check if user has department access (legacy)
    access_result = client.table("user_department_access") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if access_result.data:
        return True

    raise SecureHTTPException.access_denied(
        user_id=user_id,
        resource_type="company",
        resource_id=company_uuid
    )


def resolve_company_id(client, company_id: str) -> str:
    """
    Resolve company_id to UUID.
    Accepts either a UUID or a slug, returns the UUID.
    Uses in-memory cache to avoid repeated DB lookups.
    """
    if UUID_PATTERN.match(company_id):
        return company_id

    cache_key = company_id.lower()
    now = time.time()
    if cache_key in _company_uuid_cache:
        cached_uuid, cached_time = _company_uuid_cache[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_uuid

    result = client.table("companies").select("id").eq("slug", company_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    uuid = result.data["id"]
    _company_uuid_cache[cache_key] = (uuid, now)

    return uuid


# =============================================================================
# LOGGING HELPERS
# =============================================================================

async def log_activity(
    company_id: str,
    event_type: str,
    title: str,
    action: str = "created",
    description: Optional[str] = None,
    department_id: Optional[str] = None,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None,
    promoted_to_type: Optional[str] = None
):
    """
    Helper function to log an activity event.
    Call this from other endpoints when something notable happens.
    """
    client = get_service_client()

    data = {
        "company_id": company_id,
        "event_type": event_type,
        "action": action,
        "title": title,
        "description": description,
        "department_id": department_id,
        "related_id": related_id,
        "related_type": related_type,
        "conversation_id": conversation_id,
        "message_id": message_id
    }

    if promoted_to_type:
        data["promoted_to_type"] = promoted_to_type

    try:
        client.table("activity_logs").insert(data).execute()
    except Exception:
        pass  # Don't fail the main operation if logging fails


async def log_usage_event(
    company_id: str,
    event_type: str = "council_session",
    tokens_input: int = 0,
    tokens_output: int = 0,
    model_used: str = None,
    session_id: str = None,
    metadata: dict = None
):
    """
    Log a usage event for billing/analytics.
    IMPORTANT: Does NOT log user_id - privacy by design.

    NOTE: Automatically skips in mock mode (MOCK_LLM=true).
    """
    # Skip in mock mode - no real API calls were made
    from ... import openrouter
    if openrouter.MOCK_LLM:
        return

    client = get_service_client()

    data = {
        "company_id": company_id,
        "event_type": event_type,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "model_used": model_used,
        "session_id": session_id,
        "metadata": metadata or {}
    }

    try:
        client.table("usage_events").insert(data).execute()
    except Exception:
        pass  # Don't fail the main operation if logging fails


# =============================================================================
# LLM OPS: SESSION USAGE & RATE LIMITING
# =============================================================================

# Model pricing (per 1M tokens) - must match frontend Stage3Content.tsx
# Last verified: 2025-01-02 via OpenRouter/official docs
MODEL_PRICING = {
    # Anthropic
    'anthropic/claude-opus-4.5': {'input': 5.0, 'output': 25.0},
    'anthropic/claude-opus-4': {'input': 15.0, 'output': 75.0},
    'anthropic/claude-sonnet-4': {'input': 3.0, 'output': 15.0},
    'anthropic/claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},
    'anthropic/claude-3-5-haiku-20241022': {'input': 0.80, 'output': 4.0},  # Fixed: was 1.0/5.0
    # OpenAI
    'openai/gpt-4o': {'input': 5.0, 'output': 15.0},
    'openai/gpt-4o-mini': {'input': 0.15, 'output': 0.60},
    'openai/gpt-5.1': {'input': 1.25, 'output': 10.0},  # Fixed: was 5.0/20.0
    # Google
    'google/gemini-3-pro-preview': {'input': 2.0, 'output': 12.0},
    'google/gemini-2.5-pro-preview': {'input': 1.25, 'output': 10.0},
    'google/gemini-2.5-flash': {'input': 0.30, 'output': 2.50},  # Fixed: was 0.075/0.30
    'google/gemini-2.0-flash-001': {'input': 0.10, 'output': 0.40},
    # xAI
    'x-ai/grok-3': {'input': 3.0, 'output': 15.0},
    'x-ai/grok-4': {'input': 3.0, 'output': 15.0},
    'x-ai/grok-4-fast': {'input': 0.20, 'output': 0.50},  # New: Stage 2 reviewer
    # DeepSeek
    'deepseek/deepseek-chat': {'input': 0.28, 'output': 0.42},
    'deepseek/deepseek-chat-v3-0324': {'input': 0.28, 'output': 0.42},
    # Meta (Llama)
    'meta-llama/llama-4-maverick': {'input': 0.15, 'output': 0.60},  # New: Stage 2 reviewer
    # Moonshot (Kimi)
    'moonshotai/kimi-k2': {'input': 0.456, 'output': 1.84},  # New: Stage 2 reviewer
}

DEFAULT_PRICING = {'input': 2.0, 'output': 8.0}


def get_model_pricing(model: str) -> dict:
    """Get pricing for a model with fallback to default."""
    if model in MODEL_PRICING:
        return MODEL_PRICING[model]
    # Try partial match
    for key, pricing in MODEL_PRICING.items():
        if model in key or key in model:
            return pricing
    return DEFAULT_PRICING


def calculate_cost_cents(usage_data: dict) -> int:
    """Calculate cost in cents from usage data with per-model breakdown."""
    total_cost = 0.0

    by_model = usage_data.get('by_model', {})
    if by_model:
        for model, model_usage in by_model.items():
            pricing = get_model_pricing(model)
            input_cost = (model_usage.get('prompt_tokens', 0) / 1_000_000) * pricing['input']
            output_cost = (model_usage.get('completion_tokens', 0) / 1_000_000) * pricing['output']
            total_cost += input_cost + output_cost
    else:
        # Fallback to total tokens with default pricing
        pricing = DEFAULT_PRICING
        input_cost = (usage_data.get('prompt_tokens', 0) / 1_000_000) * pricing['input']
        output_cost = (usage_data.get('completion_tokens', 0) / 1_000_000) * pricing['output']
        total_cost = input_cost + output_cost

    # Convert to cents
    return int(total_cost * 100)


async def save_internal_llm_usage(
    company_id: str,
    operation_type: str,
    model: str,
    usage: dict,
    related_id: str = None
) -> bool:
    """
    Track internal LLM operations (title generation, project extraction, summaries, etc.).

    These are "invisible" operations that consume tokens but aren't part of council sessions.
    Tracking them gives visibility into total LLM costs.

    NOTE: Automatically skips saving in mock mode (MOCK_LLM=true) since no real API
    calls are made. This check happens here so callers don't need to check.

    Args:
        company_id: Company UUID
        operation_type: Type of operation:
            - 'title_generation': Auto-generating conversation titles
            - 'project_extraction': Extracting project from council response
            - 'context_structuring': Structuring free-form project descriptions
            - 'decision_merge': Merging decisions into project context
            - 'context_regeneration': Regenerating project context from decisions
            - 'decision_summary': Generating decision summaries
        model: The model used (e.g., 'google/gemini-2.5-flash')
        usage: Token usage dict from query_model response:
            - prompt_tokens: Input tokens
            - completion_tokens: Output tokens
            - total_tokens: Total tokens
            - cache_creation_input_tokens: Cache creation (if applicable)
            - cache_read_input_tokens: Cache read (if applicable)
        related_id: Optional related resource ID (conversation_id, project_id, decision_id)

    Returns:
        True if saved successfully, False if skipped (mock mode) or failed
    """
    # Skip in mock mode - no real API calls were made
    from ... import openrouter
    if openrouter.MOCK_LLM:
        return False

    if not company_id or not usage:
        return False

    client = get_service_client()

    # Calculate cost for this single model call
    pricing = get_model_pricing(model)
    prompt_tokens = usage.get('prompt_tokens', 0)
    completion_tokens = usage.get('completion_tokens', 0)
    total_tokens = usage.get('total_tokens', 0) or (prompt_tokens + completion_tokens)

    input_cost = (prompt_tokens / 1_000_000) * pricing['input']
    output_cost = (completion_tokens / 1_000_000) * pricing['output']
    cost_cents = int((input_cost + output_cost) * 100)

    # Build model breakdown for consistency with session_usage schema
    model_breakdown = {
        model: {
            'input': prompt_tokens,
            'output': completion_tokens,
            'total': total_tokens,
            'cost_cents': cost_cents
        }
    }

    data = {
        'company_id': company_id,
        'related_id': related_id,  # Use dedicated column (no FK constraint)
        # Note: conversation_id has FK to conversations table, don't use for non-conversation IDs
        'tokens_input': prompt_tokens,
        'tokens_output': completion_tokens,
        'tokens_total': total_tokens,
        'cache_creation_tokens': usage.get('cache_creation_input_tokens', 0),
        'cache_read_tokens': usage.get('cache_read_input_tokens', 0),
        'estimated_cost_cents': cost_cents,
        'model_breakdown': model_breakdown,
        'session_type': f'internal_{operation_type}',  # Prefix with 'internal_' to distinguish
        'model_count': 1,
    }

    try:
        client.table('session_usage').insert(data).execute()
        log_app_event(
            "INTERNAL_LLM_USAGE_SAVED",
            level="DEBUG",
            company_id=company_id,
            operation=operation_type,
            model=model,
            tokens=total_tokens,
            cost_cents=cost_cents
        )
        return True
    except Exception as e:
        log_app_event("INTERNAL_LLM_USAGE_SAVE_FAILED", level="WARNING", error=str(e), operation=operation_type)
        return False


async def save_session_usage(
    company_id: str,
    conversation_id: str,
    usage_data: dict,
    session_type: str = 'council'
) -> bool:
    """
    Save detailed session usage for analytics.

    NOTE: Automatically skips saving in mock mode (MOCK_LLM=true) since no real API
    calls are made. This check happens here so callers don't need to check.

    Args:
        company_id: Company UUID
        conversation_id: Conversation/session UUID
        usage_data: Token usage dict from council run
        session_type: 'council', 'chat', 'triage', or 'document'

    Returns:
        True if saved successfully, False if skipped (mock mode) or failed
    """
    # Skip in mock mode - no real API calls were made
    from ... import openrouter
    if openrouter.MOCK_LLM:
        return False

    client = get_service_client()

    # Calculate cost
    cost_cents = calculate_cost_cents(usage_data)

    # Build model breakdown with costs
    model_breakdown = {}
    for model, model_usage in usage_data.get('by_model', {}).items():
        pricing = get_model_pricing(model)
        input_cost = (model_usage.get('prompt_tokens', 0) / 1_000_000) * pricing['input']
        output_cost = (model_usage.get('completion_tokens', 0) / 1_000_000) * pricing['output']
        model_breakdown[model] = {
            'input': model_usage.get('prompt_tokens', 0),
            'output': model_usage.get('completion_tokens', 0),
            'total': model_usage.get('total_tokens', 0),
            'cost_cents': int((input_cost + output_cost) * 100)
        }

    data = {
        'company_id': company_id,
        'conversation_id': conversation_id,
        'tokens_input': usage_data.get('prompt_tokens', 0),
        'tokens_output': usage_data.get('completion_tokens', 0),
        'tokens_total': usage_data.get('total_tokens', 0),
        'cache_creation_tokens': usage_data.get('cache_creation_input_tokens', 0),
        'cache_read_tokens': usage_data.get('cache_read_input_tokens', 0),
        'estimated_cost_cents': cost_cents,
        'model_breakdown': model_breakdown,
        'session_type': session_type,
        'model_count': len(usage_data.get('by_model', {})),
    }

    try:
        client.table('session_usage').insert(data).execute()
        log_app_event(
            "SESSION_USAGE_SAVED",
            level="DEBUG",
            company_id=company_id,
            tokens=usage_data.get('total_tokens', 0),
            cost_cents=cost_cents
        )
        return True
    except Exception as e:
        log_app_event("SESSION_USAGE_SAVE_FAILED", level="WARNING", error=str(e))
        return False


async def check_rate_limits(company_id: str) -> dict:
    """
    Check if company has exceeded any rate limits.

    Returns:
        {
            'allowed': True/False,
            'exceeded': ['limit_type', ...],
            'warnings': ['limit_type', ...],
            'details': { limit_type: { current, limit } }
        }
    """
    client = get_service_client()

    try:
        result = client.rpc('check_rate_limits', {'p_company_id': company_id}).execute()
        limits = result.data or []

        exceeded = []
        warnings = []
        details = {}

        for limit in limits:
            limit_type = limit['limit_type']
            details[limit_type] = {
                'current': limit['current_value'],
                'limit': limit['limit_value']
            }
            if limit['is_exceeded']:
                exceeded.append(limit_type)
            elif limit['is_warning']:
                warnings.append(limit_type)

        return {
            'allowed': len(exceeded) == 0,
            'exceeded': exceeded,
            'warnings': warnings,
            'details': details
        }
    except Exception as e:
        log_app_event("RATE_LIMIT_CHECK_FAILED", level="WARNING", error=str(e))
        # Fail open - allow the request
        return {'allowed': True, 'exceeded': [], 'warnings': [], 'details': {}}


async def increment_rate_counters(
    company_id: str,
    sessions: int = 1,
    tokens: int = 0,
    cost_cents: int = 0
) -> dict:
    """
    Increment rate limit counters after a session.

    NOTE: Automatically skips in mock mode (MOCK_LLM=true).

    Returns current counter values, or empty dict if skipped.
    """
    # Skip in mock mode - no real API calls were made
    from ... import openrouter
    if openrouter.MOCK_LLM:
        return {}

    client = get_service_client()

    try:
        result = client.rpc('increment_rate_limit_counter', {
            'p_company_id': company_id,
            'p_sessions': sessions,
            'p_tokens': tokens,
            'p_cost_cents': cost_cents
        }).execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return {
                'hourly_sessions': row.get('hourly_sessions', 0),
                'daily_sessions': row.get('daily_sessions', 0),
                'monthly_tokens': row.get('monthly_tokens', 0),
                'monthly_cost_cents': row.get('monthly_cost_cents', 0)
            }
        return {}
    except Exception as e:
        log_app_event("RATE_COUNTER_INCREMENT_FAILED", level="WARNING", error=str(e))
        return {}


async def get_usage_analytics(company_id: str, days: int = 30) -> list:
    """
    Get usage analytics for dashboard display.

    Returns list of daily usage summaries.
    """
    client = get_service_client()

    try:
        result = client.rpc('get_usage_analytics', {
            'p_company_id': company_id,
            'p_days': days
        }).execute()
        return result.data or []
    except Exception as e:
        log_app_event("USAGE_ANALYTICS_FAILED", level="WARNING", error=str(e))
        return []


async def get_rate_limit_config(company_id: str) -> dict:
    """Get rate limit configuration for a company."""
    client = get_service_client()

    try:
        result = client.table('rate_limits').select('*').eq('company_id', company_id).single().execute()
        if result.data:
            return result.data
    except Exception:
        pass

    # Return defaults
    return {
        'sessions_per_hour': 20,
        'sessions_per_day': 100,
        'tokens_per_month': 10_000_000,
        'budget_cents_per_month': 10_000,
        'alert_threshold_percent': 80,
        'tier': 'free'
    }


async def create_budget_alert(
    company_id: str,
    alert_type: str,
    current_value: int,
    limit_value: int
) -> bool:
    """Create a budget alert if one doesn't already exist for this period."""
    client = get_service_client()

    # Determine period start based on alert type
    from datetime import datetime
    now = datetime.now()
    if 'hourly' in alert_type:
        period_start = now.replace(minute=0, second=0, microsecond=0)
    elif 'daily' in alert_type:
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        # Check if alert already exists for this period
        existing = client.table('budget_alerts') \
            .select('id') \
            .eq('company_id', company_id) \
            .eq('alert_type', alert_type) \
            .eq('period_start', period_start.isoformat()) \
            .execute()

        if existing.data and len(existing.data) > 0:
            return False  # Already alerted

        # Create new alert
        client.table('budget_alerts').insert({
            'company_id': company_id,
            'alert_type': alert_type,
            'current_value': current_value,
            'limit_value': limit_value,
            'period_start': period_start.isoformat()
        }).execute()

        log_app_event(
            "BUDGET_ALERT_CREATED",
            level="INFO",
            company_id=company_id,
            alert_type=alert_type,
            current_value=current_value,
            limit_value=limit_value
        )
        return True
    except Exception as e:
        log_app_event("BUDGET_ALERT_CREATE_FAILED", level="WARNING", error=str(e))
        return False


# =============================================================================
# AI HELPERS
# =============================================================================

async def auto_regenerate_project_context(project_id: str, user: dict) -> bool:
    """
    Automatically regenerate project context when a decision is saved.
    Uses the single 'sarah' persona for consistent output.
    """
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback

    log_app_event("AUTO_SYNTH", "Regenerating context", resource_id=project_id)

    service_client = get_service_client()

    project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
    if not project_result.data:
        return False

    project = project_result.data

    decisions_result = service_client.table("knowledge_entries") \
        .select("id, title, content, created_at, department_ids") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=False) \
        .execute()

    decisions = decisions_result.data or []
    if not decisions:
        return False

    if MOCK_LLM:
        mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nAuto-synthesized from {len(decisions)} decisions."
        service_client.table("projects").update({
            "context_md": mock_context,
            "updated_at": datetime.now().isoformat()
        }).eq("id", project_id).execute()
        return True

    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(models, str):
        models = json.loads(models)

    decisions_summary = ""
    for i, d in enumerate(decisions, 1):
        date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
        title = d.get("title", "Untitled")
        content = d.get("content", "")
        if len(content) > 1000:
            content = content[:1000] + "..."
        decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n{content}\n"

    today_date = datetime.now().strftime("%B %d, %Y")

    user_prompt = f"""Create a CLEAN, WELL-ORGANIZED project document.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## ALL DECISIONS MADE FOR THIS PROJECT
{decisions_summary}

---

Create a single, clean project document that:
1. Starts with a clear project overview
2. Synthesizes ALL decisions into organized sections
3. ELIMINATES ALL DUPLICATES
4. Uses clear, simple language
5. Includes a "Decision Log" section with dates

Return valid JSON:
{{
  "context_md": "The complete project documentation in markdown"
}}

Today's date: {today_date}"""

    messages = [
        {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
        {"role": "user", "content": user_prompt}
    ]

    result_data = None
    last_error = None
    company_id = project.get("company_id")  # For usage tracking

    for model in models:
        try:
            result = await query_model(model=model, messages=messages)

            # Track internal LLM usage if company_id available
            if company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type='auto_context_regeneration',
                        model=model,
                        usage=result['usage'],
                        related_id=project_id
                    )
                except Exception:
                    pass  # Don't fail regeneration if tracking fails

            if result and result.get('content'):
                content = result['content']
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                if '```' in content:
                    content = content.split('```')[0]
                content = content.strip()

                try:
                    result_data = json.loads(content)
                    break
                except json.JSONDecodeError:
                    last_error = f"JSON parse error from {model}"
                    continue
            else:
                last_error = f"No response from {model}"
                continue
        except Exception as e:
            last_error = f"{model} failed: {type(e).__name__}"
            continue

    if result_data is None:
        log_app_event("AUTO_SYNTH", f"All models failed: {last_error}", resource_id=project_id, level="ERROR")
        return False

    new_context = result_data.get("context_md", "")

    service_client.table("projects").update({
        "context_md": new_context,
        "updated_at": datetime.now().isoformat()
    }).eq("id", project_id).execute()

    return True


async def generate_decision_summary_internal(
    decision_id: str,
    company_uuid: str,
    service_client=None
) -> dict:
    """
    Generate an AI summary for a decision - includes title and contextual summary.
    Uses the 'sarah' persona from the database for consistent style.

    REFACTORED: Complexity reduced from E (44) to B (~10) by extracting helper functions.
    """
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from .utils_refactored import (
        _fetch_decision_data,
        _fetch_prior_context,
        _generate_mock_summary,
        _build_prompt,
        _parse_llm_response,
        _update_decision_with_summary,
        _get_fallback_summary,
        _track_summary_llm_usage
    )

    if service_client is None:
        service_client = get_service_client()

    # 1. Fetch decision data
    decision = _fetch_decision_data(service_client, decision_id, company_uuid)
    if not decision:
        return {"summary": "Decision not found", "title": "Unknown", "cached": False}

    user_question = decision.get("question", "")
    council_response = decision.get("content", "")
    conversation_id = decision.get("source_conversation_id")
    response_index = decision.get("response_index", 0) or 0

    if not user_question and not council_response:
        return {"summary": "No content recorded for this decision.", "title": decision.get("title"), "cached": False}

    # 2. Fetch prior context if this is a follow-up decision
    prior_context = _fetch_prior_context(service_client, conversation_id, response_index, company_uuid)

    # 3. Handle MOCK_LLM mode
    if MOCK_LLM:
        return _generate_mock_summary(user_question, council_response)

    # 4. Get persona and build prompt
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    council_excerpt = council_response[:2500] if council_response else ""

    user_prompt = _build_prompt(
        prior_context, user_question, council_excerpt, response_index,
        _build_followup_prompt, _build_legacy_prompt, _build_standard_prompt
    )

    # 5. Get model preferences
    model_prefs = persona.get('model_preferences', ['google/gemini-2.0-flash-001'])
    if isinstance(model_prefs, str):
        model_prefs = json.loads(model_prefs)
    model_used = model_prefs[0]

    # 6. Call LLM and process response
    try:
        response = await query_model(
            model_used,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        # Track LLM usage
        await _track_summary_llm_usage(company_uuid, decision_id, model_used, response, save_internal_llm_usage)

        # Parse response
        content = response.get("content", "").strip() if response else ""
        generated_title, generated_question_summary, generated_summary = _parse_llm_response(
            content, decision.get("title")
        )

        # Update decision with summary
        result = _update_decision_with_summary(
            service_client, decision_id, generated_title, generated_summary,
            generated_question_summary, decision.get("title")
        )

        if result:
            return result
        else:
            return _get_fallback_summary(user_question, council_response, decision.get("title"))

    except Exception:
        return _get_fallback_summary(user_question, council_response, decision.get("title"))


def _build_followup_prompt(prior_context: str, user_question: str, council_excerpt: str, response_index: int) -> str:
    """Build prompt for follow-up decisions."""
    return f"""## TASK: Generate a title and summary for this follow-up decision

## CONTEXT - THIS IS DECISION #{response_index + 1} (A FOLLOW-UP)

## WHAT HAPPENED BEFORE:
{prior_context}

## WHAT THE USER ASKED IN THIS FOLLOW-UP:
{user_question}

## WHAT THE COUNCIL RESPONDED:
{council_excerpt}

## YOUR TASK
Generate a TITLE and SUMMARY:

1. **TITLE** (5-10 words): Must show this is a follow-up/iteration.

2. **SUMMARY**: Write in third person, referring to "the user" and "the council".

## OUTPUT FORMAT
TITLE: [your specific follow-up title]

SUMMARY:
[Your summary here]"""


def _build_legacy_prompt(council_excerpt: str) -> str:
    """Build prompt for legacy decisions without user question."""
    return f"""## TASK: Generate a title and summary from this council decision

## THE COUNCIL'S RESPONSE (no original question recorded):
{council_excerpt}

## YOUR TASK
Generate a title and summary based on the council's response alone.

1. **TITLE** (4-8 words): Specific title capturing what the council discussed.

2. **SUMMARY**: Write in third person, referring to "the council".

## OUTPUT FORMAT
TITLE: [your specific title]

SUMMARY:
[Your summary here]"""


def _build_standard_prompt(user_question: str, council_excerpt: str) -> str:
    """Build prompt for standard decisions with user question."""
    return f"""## TASK: Generate a title, question summary, and decision summary

## THE USER'S QUESTION:
{user_question}

## THE COUNCIL'S RESPONSE:
{council_excerpt}

## YOUR TASK
Generate THREE things:

1. **TITLE** (4-8 words): Specific title capturing the decision topic.

2. **QUESTION_SUMMARY** (1-2 sentences): A concise summary of what the user asked.

3. **SUMMARY**: Write in third person, referring to "the user" and "the council".

## OUTPUT FORMAT
TITLE: [your specific title]

QUESTION_SUMMARY: [1-2 sentence summary of what the user asked]

SUMMARY:
[Your summary here]"""


# =============================================================================
# PYDANTIC MODELS (shared across sub-routers)
# =============================================================================

class DepartmentCreate(BaseModel):
    """Create a new department."""
    name: str
    slug: str
    description: Optional[str] = None
    purpose: Optional[str] = None


class DepartmentUpdate(BaseModel):
    """Update a department."""
    name: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    context_md: Optional[str] = None
    llm_preset: Optional[Literal['conservative', 'balanced', 'creative']] = None


class RoleCreate(BaseModel):
    """Create a new role."""
    name: str
    slug: str
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    system_prompt: Optional[str] = None


class RoleUpdate(BaseModel):
    """Update a role."""
    name: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    system_prompt: Optional[str] = None


class PlaybookCreate(BaseModel):
    """Create a new playbook (SOP/framework/policy)."""
    title: str
    slug: Optional[str] = None  # Auto-generated from title if not provided
    doc_type: str
    content: str
    summary: Optional[str] = None
    department_id: Optional[str] = None
    auto_inject: bool = True
    tags: List[str] = []
    additional_departments: List[str] = []


class PlaybookUpdate(BaseModel):
    """Update a playbook."""
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    auto_inject: Optional[bool] = None
    change_summary: Optional[str] = None
    tags: Optional[List[str]] = None
    additional_departments: Optional[List[str]] = None


class DecisionCreate(BaseModel):
    """Save a council decision."""
    title: str
    content: str
    department_id: Optional[str] = None
    project_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    response_index: Optional[int] = None
    tags: List[str] = []
    council_type: Optional[str] = None
    user_question: Optional[str] = None
    content_summary: Optional[str] = None


class PromoteDecision(BaseModel):
    """Promote a decision to a playbook."""
    doc_type: str
    title: str
    slug: Optional[str] = None
    summary: Optional[str] = None


class MemberInvite(BaseModel):
    """Invite a new member to the company."""
    email: str
    role: str = "member"


class MemberUpdate(BaseModel):
    """Update a member's role."""
    role: str
