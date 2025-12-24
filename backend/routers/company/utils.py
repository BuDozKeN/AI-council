"""
Company Router Utilities

Shared helpers, validators, and Pydantic models for company sub-routers.
"""

from fastapi import HTTPException, Path
from pydantic import BaseModel
from typing import Optional, List, Annotated
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
    """
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

    for model in models:
        try:
            result = await query_model(model=model, messages=messages)

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
    """
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback

    if service_client is None:
        service_client = get_service_client()

    result = service_client.table("knowledge_entries") \
        .select("id, question, content, title, content_summary, source_conversation_id, response_index, created_at") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        return {"summary": "Decision not found", "title": "Unknown", "cached": False}

    decision = result.data
    user_question = decision.get("question", "")
    council_response = decision.get("content", "")
    conversation_id = decision.get("source_conversation_id")
    response_index = decision.get("response_index", 0) or 0

    if not user_question and not council_response:
        return {"summary": "No content recorded for this decision.", "title": decision.get("title"), "cached": False}

    # Fetch prior decisions from the same conversation for context
    prior_context = ""
    if conversation_id and response_index > 0:
        try:
            prior_result = service_client.table("knowledge_entries") \
                .select("question, content, content_summary, title, response_index") \
                .eq("source_conversation_id", conversation_id) \
                .eq("company_id", company_uuid) \
                .lt("response_index", response_index) \
                .order("response_index") \
                .execute()

            if prior_result.data:
                prior_items = []
                for prior in prior_result.data:
                    idx = prior.get("response_index", 0) or 0
                    prior_q = prior.get("question", "")
                    prior_title = prior.get("title", "")
                    prior_response = prior.get("content", "")
                    prior_summary = prior.get("content_summary", "")

                    item = f"### Decision #{idx + 1}: {prior_title}\n"
                    item += f"**User asked:** {prior_q}\n"
                    if prior_summary:
                        item += f"**Summary:** {prior_summary}\n"
                    elif prior_response:
                        first_para = prior_response.split('\n\n')[0][:400]
                        item += f"**Council decided:** {first_para}...\n"
                    prior_items.append(item)

                if prior_items:
                    prior_context = "\n\n".join(prior_items)
        except Exception:
            pass

    if MOCK_LLM:
        if user_question:
            mock_title = f"Decision about {user_question[:30]}..."
            mock_summary = f"The user asked about {user_question[:100]}..."
        else:
            mock_title = "Council Decision Summary"
            mock_summary = f"The council discussed: {council_response[:100]}..."
        return {"summary": mock_summary, "title": mock_title, "cached": False}

    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    council_excerpt = council_response[:2500] if council_response else ""

    # Build prompt based on context
    if prior_context and response_index > 0:
        user_prompt = _build_followup_prompt(prior_context, user_question, council_excerpt, response_index)
    elif not user_question:
        user_prompt = _build_legacy_prompt(council_excerpt)
    else:
        user_prompt = _build_standard_prompt(user_question, council_excerpt)

    model_prefs = persona.get('model_preferences', ['google/gemini-2.0-flash-001'])
    if isinstance(model_prefs, str):
        model_prefs = json.loads(model_prefs)

    try:
        response = await query_model(
            model_prefs[0],
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        content = response.get("content", "").strip() if response else ""

        generated_title = decision.get("title")
        generated_question_summary = ""
        generated_summary = ""

        if "TITLE:" in content:
            title_match = content.split("TITLE:")[1] if "TITLE:" in content else ""
            if "QUESTION_SUMMARY:" in title_match:
                generated_title = title_match.split("QUESTION_SUMMARY:")[0].strip()
            elif "SUMMARY:" in title_match:
                generated_title = title_match.split("SUMMARY:")[0].strip()
            else:
                generated_title = title_match.split("\n")[0].strip()

            if "QUESTION_SUMMARY:" in content:
                qs_part = content.split("QUESTION_SUMMARY:")[1]
                if "SUMMARY:" in qs_part:
                    generated_question_summary = qs_part.split("SUMMARY:")[0].strip()
                else:
                    generated_question_summary = qs_part.split("\n")[0].strip()

            if "SUMMARY:" in content:
                parts = content.split("SUMMARY:")
                generated_summary = parts[-1].strip()
        else:
            generated_summary = content

        if generated_summary or generated_question_summary:
            update_data = {"content_summary": generated_summary}

            if generated_title and generated_title != decision.get("title"):
                update_data["title"] = generated_title

            if generated_question_summary:
                update_data["question_summary"] = generated_question_summary

            service_client.table("knowledge_entries") \
                .update(update_data) \
                .eq("id", decision_id) \
                .execute()

            return {
                "summary": generated_summary,
                "title": generated_title,
                "question_summary": generated_question_summary,
                "cached": False
            }
        else:
            fallback = user_question[:300] if user_question else (council_response[:300] if council_response else "No content available")
            return {"summary": fallback, "title": decision.get("title"), "cached": False}

    except Exception:
        fallback = user_question[:300] if user_question else (council_response[:300] if council_response else "No content available")
        return {"summary": fallback, "title": decision.get("title"), "cached": False}


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
    slug: str
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
