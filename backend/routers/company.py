"""
My Company API Router

Unified endpoints for managing company organization:
- Overview (company info + stats)
- Team (departments & roles)
- Playbooks (SOPs, frameworks, policies)
- Decisions (saved council outputs)

Per Council recommendation: ALL data comes from Supabase database.
The filesystem (councils/organisations/) is deprecated for runtime use.
"""

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from typing import Optional, List, Annotated
from datetime import datetime
import re
import uuid
from functools import lru_cache
import time

from ..auth import get_current_user
from ..database import get_supabase_with_auth, get_supabase_service
from ..security import SecureHTTPException, log_security_event, log_app_event, escape_sql_like_pattern
from ..utils.cache import company_cache, user_cache, cache_key, invalidate_company_cache


router = APIRouter(prefix="/api/company", tags=["company"])

# UUID pattern for validation
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

# =============================================================================
# SECURITY: Input validation for path parameters
# =============================================================================
# Pattern allows UUIDs and safe slugs (alphanumeric, underscore, hyphen)
SAFE_ID_PATTERN = r'^[a-zA-Z0-9_-]+$'


def validate_path_id(value: str, field_name: str = "id") -> str:
    """
    Validate that a path parameter contains only safe characters.
    Prevents path traversal and injection attacks.
    """
    if not value or not re.match(SAFE_ID_PATTERN, value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must contain only letters, numbers, underscores, and hyphens"
        )
    return value


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


# ============================================
# PYDANTIC MODELS
# ============================================

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
    doc_type: str  # 'sop', 'framework', 'policy'
    content: str
    summary: Optional[str] = None
    department_id: Optional[str] = None
    auto_inject: bool = True
    tags: List[str] = []
    additional_departments: List[str] = []  # Additional department IDs for visibility


class PlaybookUpdate(BaseModel):
    """Update a playbook."""
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    auto_inject: Optional[bool] = None
    change_summary: Optional[str] = None
    tags: Optional[List[str]] = None
    additional_departments: Optional[List[str]] = None  # Replace all additional departments


class DecisionCreate(BaseModel):
    """Save a council decision."""
    title: str
    content: str
    department_id: Optional[str] = None
    project_id: Optional[str] = None  # Link to a project for timeline tracking
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    response_index: Optional[int] = None  # Index of the response within the conversation (for multi-decision tracking)
    tags: List[str] = []
    council_type: Optional[str] = None  # e.g., "CTO Council", "Legal Council", "Board"
    user_question: Optional[str] = None  # The original question that triggered this decision
    content_summary: Optional[str] = None  # Brief summary for quick scanning (maps to content_summary column)


class PromoteDecision(BaseModel):
    """Promote a decision to a playbook."""
    doc_type: str  # 'sop', 'framework', 'policy'
    title: str
    slug: Optional[str] = None  # Auto-generated from title if not provided
    summary: Optional[str] = None


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_client(user):
    """Get authenticated Supabase client."""
    # user is a dict from get_current_user, access with bracket notation
    if isinstance(user, dict):
        access_token = user.get('access_token')
    else:
        access_token = user.access_token
    return get_supabase_with_auth(access_token)


def get_service_client():
    """
    Get Supabase service client (bypasses RLS).
    Used for read-only operations where user is already authenticated.
    """
    client = get_supabase_service()
    if not client:
        raise HTTPException(status_code=500, detail="Service client not configured")
    return client


def verify_company_access(client, company_uuid: str, user: dict) -> bool:
    """
    Verify that the authenticated user has access to the specified company.

    Access is granted if:
    1. User owns the company (companies.user_id = user.id)
    2. User is a member of the company (company_members table)
    3. User has department access to the company (user_department_access table - legacy)

    Args:
        client: Supabase service client
        company_uuid: The company UUID to check access for
        user: The authenticated user dict from get_current_user

    Returns:
        True if user has access, raises HTTPException otherwise
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

    # Check if user is a member of this company (multi-user system)
    member_result = client.table("company_members") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if member_result.data:
        return True

    # Check if user has department access to this company (legacy)
    access_result = client.table("user_department_access") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", user_id) \
        .execute()

    if access_result.data:
        return True

    # No access - log and raise 403
    raise SecureHTTPException.access_denied(
        user_id=user_id,
        resource_type="company",
        resource_id=company_uuid
    )


async def auto_regenerate_project_context(project_id: str, user: dict) -> bool:
    """
    Automatically regenerate project context when a decision is saved.
    This synthesizes ALL decisions into the project context.
    Uses the single 'sarah' persona for consistent output.

    Returns True if context was updated, False otherwise.
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_db_persona_with_fallback
    from datetime import datetime
    import json

    log_app_event("AUTO_SYNTH", "Regenerating context", resource_id=project_id)

    service_client = get_service_client()

    # Get project details
    project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
    if not project_result.data:
        return False

    project = project_result.data

    # Get ALL decisions for this project
    decisions_result = service_client.table("knowledge_entries") \
        .select("id, title, content, created_at, department_ids") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=False) \
        .execute()

    decisions = decisions_result.data or []

    if not decisions:
        return False

    # Handle mock mode
    if MOCK_LLM:
        mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nAuto-synthesized from {len(decisions)} decisions."
        service_client.table("projects").update({
            "context_md": mock_context,
            "updated_at": datetime.now().isoformat()
        }).eq("id", project_id).execute()
        return True

    # Get the ONE Sarah persona from database
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(models, str):
        models = json.loads(models)

    # Build decisions summary for LLM
    decisions_summary = ""
    for i, d in enumerate(decisions, 1):
        date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
        title = d.get("title", "Untitled")
        content = d.get("content", "")
        # Truncate long content for LLM context
        if len(content) > 1000:
            content = content[:1000] + "..."
        decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n{content}\n"

    today_date = datetime.now().strftime("%B %d, %Y")

    # Task-specific user prompt (Sarah's personality comes from system_prompt)
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
3. ELIMINATES ALL DUPLICATES - if information appears in multiple decisions, include it ONCE
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
                # Clean up markdown code blocks
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

    # Update the project with new context
    service_client.table("projects").update({
        "context_md": new_context,
        "updated_at": datetime.now().isoformat()
    }).eq("id", project_id).execute()

    return True


def resolve_company_id(client, company_id: str) -> str:
    """
    Resolve company_id to UUID.
    Accepts either a UUID or a slug, returns the UUID.
    Uses in-memory cache to avoid repeated DB lookups.
    """
    # Check if it's already a valid UUID format
    if UUID_PATTERN.match(company_id):
        return company_id

    # Check cache first
    cache_key = company_id.lower()
    now = time.time()
    if cache_key in _company_uuid_cache:
        cached_uuid, cached_time = _company_uuid_cache[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_uuid

    # Cache miss - look up by slug
    result = client.table("companies").select("id").eq("slug", company_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Store in cache
    uuid = result.data["id"]
    _company_uuid_cache[cache_key] = (uuid, now)

    return uuid


async def generate_decision_summary_internal(
    decision_id: str,
    company_uuid: str,
    service_client=None
) -> dict:
    """
    Generate an AI summary for a decision - includes title and contextual summary.
    Uses the 'sarah' persona from the database for consistent style.
    For multi-turn conversations, includes context from prior decisions.

    This is the core logic, extracted so it can be called from both:
    1. The API endpoint (on-demand regeneration)
    2. The merge endpoint (at save time)

    Returns: {"summary": str, "title": str, "cached": bool}
    """

    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_db_persona_with_fallback

    if service_client is None:
        service_client = get_service_client()

    # Get the decision with conversation info AND content (council response)
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

    # If no user_question AND no council_response, can't generate a meaningful summary
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
        except Exception as e:
            pass  # Non-critical: proceed without prior context

    # Handle mock mode
    if MOCK_LLM:
        if user_question:
            mock_title = f"Decision about {user_question[:30]}..."
            mock_summary = f"The user asked about {user_question[:100]}..."
        else:
            mock_title = "Council Decision Summary"
            mock_summary = f"The council discussed: {council_response[:100]}..."
        return {"summary": mock_summary, "title": mock_title, "cached": False}

    # Get the project manager persona from database
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    # Build the summary generation prompt
    council_excerpt = council_response[:2500] if council_response else ""

    # Different prompts depending on available context
    # 1. Follow-up decision (has prior context and response_index > 0)
    # 2. First decision with user question
    # 3. Decision without user question (legacy data - extract from council response)
    if prior_context and response_index > 0:
        user_prompt = f"""## TASK: Generate a title and summary for this follow-up decision

## CONTEXT - THIS IS DECISION #{response_index + 1} (A FOLLOW-UP)

The user had a previous conversation with the council. Now they're following up with additional questions or requesting a different perspective.

## WHAT HAPPENED BEFORE:
{prior_context}

## WHAT THE USER ASKED IN THIS FOLLOW-UP:
{user_question}

## WHAT THE COUNCIL RESPONDED:
{council_excerpt}

## YOUR TASK
Generate a TITLE and SUMMARY that help someone understand THIS SPECIFIC follow-up:

1. **TITLE** (5-10 words): Must show this is a follow-up/iteration. Examples:
   - "UX Council Review of CTO Wait Strategy"
   - "Design Implementation Follow-up: Loading States"
   - "Iteration 2: UX Refinements for Engagement"

2. **SUMMARY**: Write in third person, referring to "the user" and "the council".

   **FORMAT YOUR SUMMARY WITH CLEAR STRUCTURE:**
   - Use **short paragraphs** (2-3 sentences each) separated by blank lines
   - Use **bullet points** for lists of recommendations or key points
   - Bold **key terms** or **important concepts**

   **MUST COVER:**
   - What did the user ask the council to do differently this time?
   - What new perspective or expertise were they seeking?
   - What key new insights did the council provide?

## OUTPUT FORMAT
TITLE: [your specific follow-up title]

SUMMARY:
[First paragraph: context and what the user asked - 2-3 sentences]

[Second paragraph or bullets: key council insights - can use bullet points]

[Final sentence: outcome or next steps]"""
    elif not user_question:
        # Legacy decision without user_question - extract from council response alone
        user_prompt = f"""## TASK: Generate a title and summary from this council decision

## THE COUNCIL'S RESPONSE (no original question recorded):
{council_excerpt}

## YOUR TASK
This is a legacy decision where the original user question wasn't recorded. Generate a title and summary based on the council's response alone.

Generate TWO things:

1. **TITLE** (4-8 words): Specific title capturing what the council discussed.
   - Extract the main topic from the council's response
   - BAD: "Council Decision" (too vague)
   - GOOD: "Department Context Structure Strategy"

2. **SUMMARY**: Write in third person, referring to "the council".

   **FORMAT YOUR SUMMARY WITH CLEAR STRUCTURE:**
   - Use **short paragraphs** (2-3 sentences each) separated by blank lines
   - Use **bullet points** for lists of recommendations or key points
   - Bold **key terms** or **important concepts**

   **MUST COVER:**
   - What topic or problem was the council addressing?
   - What were the council's key recommendations?
   - What specific approach or strategy did they suggest?

## OUTPUT FORMAT
TITLE: [your specific title]

SUMMARY:
[First paragraph: the topic being discussed - 2-3 sentences]

[Second paragraph or bullets: key council recommendations]

[Final sentence: outcome or approach suggested]"""
    else:
        user_prompt = f"""## TASK: Generate a title, question summary, and decision summary for this council decision

## THE USER'S QUESTION:
{user_question}

## THE COUNCIL'S RESPONSE:
{council_excerpt}

## YOUR TASK
Generate THREE things:

1. **TITLE** (4-8 words): Specific title capturing the decision topic.
   - BAD: "User Engagement" (too vague)
   - GOOD: "Wait Time Engagement via Progress Indicators"
   - GOOD: "CTO Council: Reducing Perceived Wait Time"

2. **QUESTION_SUMMARY** (1-2 sentences): A concise summary of what the user asked.
   - Capture the core question/problem in plain language
   - Should be understandable without reading the full question
   - Example: "The user asked whether to implement PDF support or focus solely on images for sharing development screenshots with the AI council."

3. **SUMMARY**: Write in third person, referring to "the user" and "the council".

   **FORMAT YOUR SUMMARY WITH CLEAR STRUCTURE:**
   - Use **short paragraphs** (2-3 sentences each) separated by blank lines
   - Use **bullet points** for lists of recommendations or key points
   - Bold **key terms** or **important concepts**

   **MUST COVER:**
   - What specific problem did the user bring to the council?
   - What was the council's key recommendation?
   - What specific approach or strategy did they suggest?

## OUTPUT FORMAT
TITLE: [your specific title]

QUESTION_SUMMARY: [1-2 sentence summary of what the user asked]

SUMMARY:
[First paragraph: the problem/question - 2-3 sentences]

[Second paragraph or bullets: key council recommendations]

[Final sentence: outcome or approach suggested]"""

    # Use model preferences from persona
    import json as json_module
    model_prefs = persona.get('model_preferences', ['google/gemini-2.0-flash-001'])
    if isinstance(model_prefs, str):
        model_prefs = json_module.loads(model_prefs)

    try:
        response = await query_model(
            model_prefs[0],  # Use first preferred model
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        content = response.get("content", "").strip() if response else ""

        # Parse the response - extract TITLE, QUESTION_SUMMARY, and SUMMARY
        generated_title = decision.get("title")
        generated_question_summary = ""
        generated_summary = ""

        if "TITLE:" in content:
            # Extract TITLE
            title_match = content.split("TITLE:")[1] if "TITLE:" in content else ""
            if "QUESTION_SUMMARY:" in title_match:
                generated_title = title_match.split("QUESTION_SUMMARY:")[0].strip()
            elif "SUMMARY:" in title_match:
                generated_title = title_match.split("SUMMARY:")[0].strip()
            else:
                generated_title = title_match.split("\n")[0].strip()

            # Extract QUESTION_SUMMARY if present
            if "QUESTION_SUMMARY:" in content:
                qs_part = content.split("QUESTION_SUMMARY:")[1]
                if "SUMMARY:" in qs_part:
                    generated_question_summary = qs_part.split("SUMMARY:")[0].strip()
                else:
                    generated_question_summary = qs_part.split("\n")[0].strip()

            # Extract SUMMARY
            if "SUMMARY:" in content:
                # Get everything after the last SUMMARY: marker
                parts = content.split("SUMMARY:")
                generated_summary = parts[-1].strip()
        else:
            # Fallback if no structured output
            generated_summary = content

        if generated_summary or generated_question_summary:
            # Save title, question_summary, and content_summary in the database
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
            # No summary generated, fallback to available content
            fallback = user_question[:300] if user_question else (council_response[:300] if council_response else "No content available")
            return {"summary": fallback, "title": decision.get("title"), "cached": False}

    except Exception as e:
        # Summary generation failed, return fallback
        fallback = user_question[:300] if user_question else (council_response[:300] if council_response else "No content available")
        return {"summary": fallback, "title": decision.get("title"), "cached": False}


# ============================================
# OVERVIEW ENDPOINTS
# ============================================

@router.get("/{company_id}/overview")
async def get_company_overview(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get company overview with stats from DATABASE.
    Returns company info + counts of departments, roles, playbooks, decisions.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    Cached for 5 minutes (company_cache TTL).
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Check cache first (keyed by company UUID for consistency)
    overview_cache_key = cache_key("overview", company_uuid)
    cached_result = await company_cache.get(overview_cache_key)
    if cached_result is not None:
        return cached_result

    # Get company details from database
    company_result = client.table("companies") \
        .select("*") \
        .eq("id", company_uuid) \
        .single() \
        .execute()

    if not company_result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    company_data = company_result.data

    # Count departments
    dept_result = client.table("departments") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    dept_count = dept_result.count or 0

    # Count roles
    role_result = client.table("roles") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    role_count = role_result.count or 0

    # Count playbooks
    playbook_result = client.table("org_documents") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    playbook_count = playbook_result.count or 0

    # Count decisions (now from knowledge_entries table)
    decision_result = client.table("knowledge_entries") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .execute()
    decision_count = decision_result.count or 0

    result = {
        "company": {
            "id": company_data.get("id"),
            "slug": company_data.get("slug"),
            "name": company_data.get("name", company_id.replace('-', ' ').title()),
            "context_md": company_data.get("context_md", "")
        },
        "stats": {
            "departments": dept_count,
            "roles": role_count,
            "playbooks": playbook_count,
            "decisions": decision_count
        }
    }

    # Cache the result
    await company_cache.set(overview_cache_key, result)

    return result


class CompanyContextUpdate(BaseModel):
    """Update company context."""
    context_md: str


@router.put("/{company_id}/context")
async def update_company_context(company_id: ValidCompanyId, data: CompanyContextUpdate, user=Depends(get_current_user)):
    """
    Update the company context markdown.
    This is the master context document containing mission, goals, strategy, etc.

    Uses service client to bypass RLS since companies table may not have user-level UPDATE policies.
    User authentication is verified via get_current_user dependency.
    """
    # Use service client to bypass RLS for company updates
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Update the company's context_md
    result = client.table("companies") \
        .update({
            "context_md": data.context_md
        }) \
        .eq("id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Invalidate company caches (overview includes context_md)
    await invalidate_company_cache(company_uuid)

    return {"company": result.data[0]}


class CompanyContextMergeRequest(BaseModel):
    """Request to merge new info into company context."""
    existing_context: str
    question: str  # The knowledge gap question
    answer: str    # User's answer to the question


@router.post("/{company_id}/context/merge")
async def merge_company_context(
    company_id: ValidCompanyId,
    request: CompanyContextMergeRequest,
    user=Depends(get_current_user)
):
    """
    Intelligently merge new context information into existing company context.

    Uses AI to take the user's answer to a knowledge gap question and
    incorporate it into the existing company context in the appropriate section.
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import WRITE_ASSIST_PERSONAS

    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    existing = request.existing_context or ""
    question = request.question
    answer = request.answer

    # Handle mock mode
    if MOCK_LLM:
        merged = existing + f"\n\n## Additional Information\n\n**{question}**\n{answer}"
        # Save the merged context
        client.table("companies").update({
            "context_md": merged
        }).eq("id", company_uuid).execute()
        return {"merged_context": merged}

    # Get the company-context persona prompt
    persona = WRITE_ASSIST_PERSONAS.get("company-context", {})
    system_prompt = persona.get("prompt", "You are a helpful business writer.")

    # Build merge prompt
    merge_prompt = f"""{system_prompt}

You are merging new information into an existing company context document.

## EXISTING COMPANY CONTEXT:
{existing if existing else "(No existing context yet)"}

## NEW INFORMATION TO ADD:

The user was asked: "{question}"
Their answer: "{answer}"

## YOUR TASK:

1. Integrate this new information into the existing context
2. Place it in the most appropriate section (or create one if needed)
3. Maintain the existing structure and formatting
4. Don't duplicate information - merge intelligently
5. Keep the document well-organized and professional

## EXPECTED STRUCTURE (use these sections as appropriate):
- Company Overview (what you do, stage, size)
- Mission & Vision
- Current Goals & Priorities
- Constraints (budget, resources, timeline)
- Key Policies & Standards

Return ONLY the complete updated company context document in markdown format.
Do not include any explanation or commentary - just the document."""

    # Use a fast model for merging
    models = ["anthropic/claude-3-5-haiku-20241022", "openai/gpt-4o-mini"]

    merged = None
    last_error = None

    for model in models:
        try:
            result = await query_model(
                model=model,
                messages=[{"role": "user", "content": merge_prompt}],
                max_tokens=4000,
                timeout=30.0
            )

            if result and result.get("content"):
                merged = result["content"].strip()
                break
        except Exception as e:
            last_error = str(e)
            continue

    if merged is None:
        # Fallback: simple append when AI merge fails
        merged = existing + f"\n\n## Additional Information\n\n**{question}**\n{answer}"

    # Save the merged context
    client.table("companies").update({
        "context_md": merged
    }).eq("id", company_uuid).execute()

    return {"merged_context": merged}


# ============================================
# TEAM ENDPOINTS (Departments & Roles)
# ============================================

@router.get("/{company_id}/team")
async def get_team(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get all departments with their roles from DATABASE.
    Returns hierarchical structure: departments → roles.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    Cached for 5 minutes (company_cache TTL).
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Check cache first
    team_cache_key = cache_key("team", company_uuid)
    cached_result = await company_cache.get(team_cache_key)
    if cached_result is not None:
        return cached_result

    # Get departments from database
    dept_result = client.table("departments") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("display_order") \
        .execute()

    if not dept_result.data:
        return {"departments": []}

    # Get all roles for this company
    roles_result = client.table("roles") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("display_order") \
        .execute()

    # Group roles by department_id
    roles_by_dept = {}
    for role in (roles_result.data or []):
        dept_id = role.get("department_id")
        if dept_id not in roles_by_dept:
            roles_by_dept[dept_id] = []
        roles_by_dept[dept_id].append(role)

    # Build response
    departments = []
    for dept in dept_result.data:
        dept_id = dept.get("id")
        dept_roles = roles_by_dept.get(dept_id, [])

        dept_data = {
            "id": dept_id,
            "name": dept.get("name"),
            "slug": dept.get("slug"),
            "description": dept.get("description", ""),
            "purpose": dept.get("purpose", ""),
            "context_md": dept.get("context_md", ""),
            "roles": []
        }

        for role in dept_roles:
            dept_data["roles"].append({
                "id": role.get("id"),
                "name": role.get("name"),
                "slug": role.get("slug"),
                "title": role.get("title", ""),
                "description": role.get("description", ""),
                "system_prompt": role.get("system_prompt", ""),
                "responsibilities": role.get("responsibilities", "")
            })

        departments.append(dept_data)

    result = {"departments": departments}

    # Cache the result
    await company_cache.set(team_cache_key, result)

    return result


@router.post("/{company_id}/departments")
async def create_department(company_id: ValidCompanyId, data: DepartmentCreate, user=Depends(get_current_user)):
    """Create a new department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current max display_order
    existing = client.table("departments") \
        .select("display_order") \
        .eq("company_id", company_uuid) \
        .order("display_order", desc=True) \
        .limit(1) \
        .execute()

    next_order = (existing.data[0]["display_order"] + 1) if existing.data else 0

    result = client.table("departments").insert({
        "company_id": company_uuid,
        "name": data.name,
        "slug": data.slug,
        "description": data.description,
        "purpose": data.purpose,
        "display_order": next_order
    }).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create department")

    # Invalidate company caches (team structure and overview stats changed)
    await invalidate_company_cache(company_uuid)

    return {"department": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}")
async def update_department(company_id: ValidCompanyId, dept_id: ValidDeptId, data: DepartmentUpdate, user=Depends(get_current_user)):
    """Update a department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("departments") \
        .update(update_data) \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Invalidate company caches (team structure changed)
    await invalidate_company_cache(company_uuid)

    return {"department": result.data[0]}


@router.post("/{company_id}/departments/{dept_id}/roles")
async def create_role(company_id: ValidCompanyId, dept_id: ValidDeptId, data: RoleCreate, user=Depends(get_current_user)):
    """Create a new role in a department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current max display_order for this department
    existing = client.table("roles") \
        .select("display_order") \
        .eq("department_id", dept_id) \
        .order("display_order", desc=True) \
        .limit(1) \
        .execute()

    next_order = (existing.data[0]["display_order"] + 1) if existing.data else 0

    result = client.table("roles").insert({
        "company_id": company_uuid,
        "department_id": dept_id,
        "name": data.name,
        "slug": data.slug,
        "title": data.title or data.name,
        "responsibilities": data.responsibilities,
        "system_prompt": data.system_prompt,
        "display_order": next_order
    }).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create role")

    # Invalidate company caches (team structure and overview stats changed)
    await invalidate_company_cache(company_uuid)

    return {"role": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def update_role(company_id: ValidCompanyId, dept_id: ValidDeptId, role_id: ValidRoleId, data: RoleUpdate, user=Depends(get_current_user)):
    """Update a role."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("roles") \
        .update(update_data) \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Invalidate company caches (team structure changed)
    await invalidate_company_cache(company_uuid)

    return {"role": result.data[0]}


@router.get("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def get_role(company_id: ValidCompanyId, dept_id: ValidDeptId, role_id: ValidRoleId, user=Depends(get_current_user)):
    """Get a single role with full details including system prompt."""
    client = get_client(user)

    result = client.table("roles") \
        .select("*") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    return {"role": result.data}


# ============================================
# PLAYBOOKS ENDPOINTS (SOPs, Frameworks, Policies)
# ============================================

@router.get("/{company_id}/playbooks")
async def get_playbooks(
    company_id: str,
    doc_type: Optional[str] = None,
    department_id: Optional[str] = None,
    tag: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Get all playbooks with current version content.
    Optional filters:
    - doc_type: sop/framework/policy
    - department_id: filter by owner or visible departments
    - tag: filter by tag

    Returns playbooks with departments embedded to avoid extra API calls.
    Note: Playbooks come from database. If company not in DB yet, returns empty list.
    """
    client = get_client(user)
    # Use service client for read-only department data (bypasses RLS)
    service_client = get_service_client()

    # Try to resolve company UUID - may not exist in DB yet
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        # Company not in database yet - return empty playbooks
        return {"playbooks": [], "departments": []}

    # First get all documents for this company
    doc_query = client.table("org_documents") \
        .select("*") \
        .eq("company_id", company_uuid)

    if doc_type:
        doc_query = doc_query.eq("doc_type", doc_type)

    if tag:
        # Filter by tag using array contains
        doc_query = doc_query.contains("tags", [tag])

    doc_result = doc_query.order("created_at", desc=True).execute()

    # Fetch departments for name lookup using service client (bypasses RLS)
    dept_result = service_client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()

    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    if not doc_result.data:
        departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]
        return {"playbooks": [], "departments": departments}

    # Get current versions for all documents
    doc_ids = [doc["id"] for doc in doc_result.data]
    version_result = client.table("org_document_versions") \
        .select("*") \
        .in_("document_id", doc_ids) \
        .eq("is_current", True) \
        .execute()

    # Create a map of document_id -> version
    version_map = {v["document_id"]: v for v in (version_result.data or [])}

    # Get additional department mappings for all documents
    dept_mapping_result = client.table("org_document_departments") \
        .select("document_id, department_id") \
        .in_("document_id", doc_ids) \
        .execute()

    # Create a map of document_id -> list of additional department_ids
    additional_depts_map = {}
    for mapping in (dept_mapping_result.data or []):
        doc_id = mapping["document_id"]
        if doc_id not in additional_depts_map:
            additional_depts_map[doc_id] = []
        additional_depts_map[doc_id].append(mapping["department_id"])

    # Flatten the response - extract current version content
    playbooks = []
    for doc in doc_result.data:
        version = version_map.get(doc["id"])
        if version:
            doc["content"] = version.get("content", "")
            doc["version"] = version.get("version", 1)
        else:
            doc["content"] = ""
            doc["version"] = 0

        # Add additional departments list
        doc["additional_departments"] = additional_depts_map.get(doc["id"], [])

        # Filter by department if specified (owner OR visible)
        if department_id:
            is_owner = doc.get("department_id") == department_id
            is_visible = department_id in doc["additional_departments"]
            if not (is_owner or is_visible):
                continue

        # Embed department name for display
        dept_id = doc.get("department_id")
        if dept_id and dept_id in dept_map:
            doc["department_name"] = dept_map[dept_id].get("name")
            doc["department_slug"] = dept_map[dept_id].get("slug")

        playbooks.append(doc)

    # Include departments list so frontend doesn't need separate call
    departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]

    return {"playbooks": playbooks, "departments": departments}


# IMPORTANT: Static routes must come BEFORE dynamic routes like /{playbook_id}
@router.get("/{company_id}/playbooks/tags")
async def get_playbook_tags(company_id: str, user=Depends(get_current_user)):
    """
    Get predefined playbook tag categories.

    These are structured categories that align with how the council uses playbooks/SOPs:
    - Category tags define the primary purpose of the playbook
    - The council can reference playbooks by these categories

    Returns predefined categories (not user-created free-form tags).
    """
    # Predefined categories that align with council usage
    # These represent how SOPs/frameworks/policies are typically categorized
    predefined_tags = [
        # Operational categories
        {"tag": "deployment", "description": "Deployment and release procedures"},
        {"tag": "security", "description": "Security protocols and guidelines"},
        {"tag": "onboarding", "description": "Team member onboarding processes"},
        {"tag": "incident-response", "description": "Incident handling and escalation"},
        {"tag": "communication", "description": "Communication standards and protocols"},

        # Process categories
        {"tag": "workflow", "description": "Standard workflows and processes"},
        {"tag": "approval", "description": "Approval and sign-off procedures"},
        {"tag": "compliance", "description": "Compliance and regulatory requirements"},
        {"tag": "quality", "description": "Quality assurance and testing"},

        # Domain categories
        {"tag": "technical", "description": "Technical standards and architecture"},
        {"tag": "business", "description": "Business operations and strategy"},
        {"tag": "hr", "description": "Human resources and personnel"},
        {"tag": "finance", "description": "Financial procedures and budgeting"},
        {"tag": "customer", "description": "Customer-facing processes"},

        # Lifecycle categories
        {"tag": "planning", "description": "Planning and estimation"},
        {"tag": "review", "description": "Review and retrospective processes"},
        {"tag": "maintenance", "description": "Maintenance and updates"},
    ]

    return {"tags": predefined_tags}


@router.get("/{company_id}/playbooks/{playbook_id}")
async def get_playbook(company_id: ValidCompanyId, playbook_id: str, user=Depends(get_current_user)):
    """Get a single playbook with its current version content."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Validate playbook_id is a valid UUID
    try:
        uuid.UUID(playbook_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid playbook ID format")

    # Get the playbook document
    doc_result = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Playbook not found")

    doc = doc_result.data

    # Get current version content
    version_result = client.table("org_document_versions") \
        .select("content, version") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .single() \
        .execute()

    content = ""
    version = 1
    if version_result.data:
        content = version_result.data.get("content", "")
        version = version_result.data.get("version", 1)

    return {
        "id": doc["id"],
        "title": doc.get("title"),
        "doc_type": doc.get("doc_type"),
        "slug": doc.get("slug"),
        "summary": doc.get("summary"),
        "content": content,
        "version": version,
        "department_id": doc.get("department_id"),
        "auto_inject": doc.get("auto_inject", False),
        "tags": doc.get("tags", []),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at")
    }


@router.post("/{company_id}/playbooks")
async def create_playbook(company_id: ValidCompanyId, data: PlaybookCreate, user=Depends(get_current_user)):
    """
    Create a new playbook with initial version.
    Supports tags and multi-department visibility.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Validate doc_type
    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Create the document with tags
    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": data.department_id,
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": data.slug,
        "summary": data.summary,
        "auto_inject": data.auto_inject,
        "tags": data.tags
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version
    version_result = client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": data.content,
        "status": "active",
        "is_current": True,
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    if not version_result.data:
        # Rollback document creation
        client.table("org_documents").delete().eq("id", doc_id).execute()
        raise HTTPException(status_code=400, detail="Failed to create playbook version")

    # Add additional department visibility
    if data.additional_departments:
        dept_mappings = [
            {"document_id": doc_id, "department_id": dept_id}
            for dept_id in data.additional_departments
        ]
        client.table("org_document_departments").insert(dept_mappings).execute()

    playbook = doc_result.data[0]
    playbook["content"] = data.content
    playbook["version"] = 1
    playbook["additional_departments"] = data.additional_departments

    # Log activity
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Created: {data.title}",
        description=data.summary[:200] if data.summary else None,
        department_id=data.department_id,
        related_id=doc_id,
        related_type="playbook"
    )

    return {"playbook": playbook}


@router.put("/{company_id}/playbooks/{playbook_id}")
async def update_playbook(company_id: ValidCompanyId, playbook_id: ValidPlaybookId, data: PlaybookUpdate, user=Depends(get_current_user)):
    """
    Update a playbook - creates a new version if content changed.
    Also supports updating tags and multi-department visibility.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current document
    doc_result = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Get current version separately
    version_result = client.table("org_document_versions") \
        .select("*") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .execute()

    current_version = version_result.data[0] if version_result.data else None
    current_version_num = current_version["version"] if current_version else 0

    # Update document metadata if provided
    doc_updates = {}
    if data.title is not None:
        doc_updates["title"] = data.title
    if data.summary is not None:
        doc_updates["summary"] = data.summary
    if data.auto_inject is not None:
        doc_updates["auto_inject"] = data.auto_inject
    if data.tags is not None:
        doc_updates["tags"] = data.tags

    if doc_updates:
        doc_updates["updated_at"] = datetime.utcnow().isoformat()
        client.table("org_documents").update(doc_updates).eq("id", playbook_id).execute()

    # Create new version if content changed
    if data.content is not None and (not current_version or data.content != current_version.get("content")):
        # Mark current version as not current
        if current_version:
            client.table("org_document_versions") \
                .update({"is_current": False}) \
                .eq("id", current_version["id"]) \
                .execute()

        # Create new version
        new_version = current_version_num + 1
        client.table("org_document_versions").insert({
            "document_id": playbook_id,
            "version": new_version,
            "content": data.content,
            "status": "active",
            "is_current": True,
            "change_summary": data.change_summary,
            "created_by": user.get('id') if isinstance(user, dict) else user.id
        }).execute()

    # Update additional departments if provided (replace all)
    # RLS allows modifications for company owners
    if data.additional_departments is not None:
        # Delete all existing mappings
        client.table("org_document_departments") \
            .delete() \
            .eq("document_id", playbook_id) \
            .execute()

        # Insert new mappings
        if data.additional_departments:
            dept_mappings = [
                {"document_id": playbook_id, "department_id": dept_id}
                for dept_id in data.additional_departments
            ]
            client.table("org_document_departments").insert(dept_mappings).execute()

    # Fetch updated document
    updated_doc = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .single() \
        .execute()

    updated_version = client.table("org_document_versions") \
        .select("*") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .execute()

    # Get additional departments
    dept_result = client.table("org_document_departments") \
        .select("department_id") \
        .eq("document_id", playbook_id) \
        .execute()

    playbook = updated_doc.data
    if updated_version.data:
        playbook["content"] = updated_version.data[0]["content"]
        playbook["version"] = updated_version.data[0]["version"]
    else:
        playbook["content"] = ""
        playbook["version"] = 0

    playbook["additional_departments"] = [d["department_id"] for d in (dept_result.data or [])]

    return {"playbook": playbook}


@router.delete("/{company_id}/playbooks/{playbook_id}")
async def delete_playbook(company_id: ValidCompanyId, playbook_id: ValidPlaybookId, user=Depends(get_current_user)):
    """
    Delete a playbook permanently.
    Also removes associated versions and department mappings.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Verify the playbook exists and belongs to this company
    existing = client.table("org_documents") \
        .select("id, title") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    playbook_title = existing.data.get("title", "Playbook")

    # Delete department mappings first (foreign key constraint)
    # RLS allows deletion for company owners
    client.table("org_document_departments") \
        .delete() \
        .eq("document_id", playbook_id) \
        .execute()

    # Delete versions
    client.table("org_document_versions") \
        .delete() \
        .eq("document_id", playbook_id) \
        .execute()

    # Delete the document itself
    client.table("org_documents") \
        .delete() \
        .eq("id", playbook_id) \
        .execute()

    # Log activity with related_id for tracking
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Deleted: {playbook_title}",
        description="Playbook was permanently deleted",
        related_id=playbook_id,
        related_type="playbook"
    )

    return {"success": True, "message": f"Playbook '{playbook_title}' deleted"}


# ============================================
# DECISIONS ENDPOINTS
# ============================================

@router.get("/{company_id}/decisions")
async def get_decisions(
    company_id: str,
    search: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    """
    Get all decisions (knowledge entries), newest first.
    Optional search by title/content.

    Returns decisions with department_name embedded to avoid extra API calls.
    Note: Decisions now come from knowledge_entries table.
    """
    client = get_client(user)
    # Use service client for read-only department data (bypasses RLS)
    service_client = get_service_client()

    # Try to resolve company UUID - may not exist in DB yet
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        # Company not in database yet - return empty decisions
        return {"decisions": [], "departments": []}

    # SECURITY: Verify user has access to this company
    verify_company_access(service_client, company_uuid, user)

    # Fetch departments for name lookup using service client (bypasses RLS)
    dept_result = service_client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()

    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    # Use service_client for knowledge_entries to ensure department_id is included
    # (RLS policies may filter columns for regular user client)
    query = service_client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("is_active", True)

    if search:
        # Search in title and content (escape special SQL LIKE characters)
        escaped_search = escape_sql_like_pattern(search)
        query = query.or_(f"title.ilike.%{escaped_search}%,content.ilike.%{escaped_search}%")

    result = query.order("created_at", desc=True).limit(limit).execute()

    # Transform to expected format for frontend compatibility
    decisions = []
    for entry in result.data or []:
        dept_ids = entry.get("department_ids") or []
        # Get first department for display name (backwards compat)
        first_dept_id = dept_ids[0] if dept_ids else None
        dept_info = dept_map.get(first_dept_id, {}) if first_dept_id else {}

        decisions.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "content": entry.get("content", ""),
            "question": entry.get("question", ""),
            "question_summary": entry.get("question_summary", ""),
            "content_summary": entry.get("content_summary", ""),
            "tags": entry.get("tags", []),
            "category": entry.get("category"),
            "department_ids": dept_ids,
            "department_name": dept_info.get("name"),
            "department_slug": dept_info.get("slug"),
            "project_id": entry.get("project_id"),
            "is_promoted": bool(entry.get("promoted_to_id") or entry.get("project_id")),  # Derived
            "promoted_to_id": entry.get("promoted_to_id"),
            "promoted_to_type": entry.get("promoted_to_type"),
            "promoted_by_name": entry.get("promoted_by_name"),
            "promoted_at": entry.get("promoted_at"),
            "source_conversation_id": entry.get("source_conversation_id"),
            "response_index": entry.get("response_index"),
            "created_at": entry.get("created_at"),
            "updated_at": entry.get("updated_at"),
            "scope": entry.get("scope", "department"),
            "auto_inject": entry.get("auto_inject", False),
            "council_type": entry.get("council_type")
        })

    # Include departments list so frontend doesn't need separate call
    departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]

    return {"decisions": decisions, "departments": departments}


@router.post("/{company_id}/decisions")
async def create_decision(company_id: ValidCompanyId, data: DecisionCreate, user=Depends(get_current_user)):
    """
    Save a new decision from a council session.
    Now stores in knowledge_entries table for unified knowledge management.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get user_id for created_by field
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # Build insert data with canonical column names
    insert_data = {
        "company_id": company_uuid,
        "department_ids": [data.department_id] if data.department_id else [],
        "title": data.title,
        "content": data.content,
        "question": data.user_question,
        "content_summary": data.content_summary,
        "category": "technical_decision",
        "source_conversation_id": data.source_conversation_id,
        "source_message_id": data.source_message_id,
        "tags": data.tags,
        "created_by": user_id,
        "is_active": True,
        "scope": "project" if data.project_id else "department",
        "auto_inject": False,
    }

    # Add project_id if provided (links decision to project timeline)
    if data.project_id:
        insert_data["project_id"] = data.project_id

    # Add council_type if provided
    if data.council_type:
        insert_data["council_type"] = data.council_type

    # Add response_index if provided (for tracking multiple decisions per conversation)
    if data.response_index is not None:
        insert_data["response_index"] = data.response_index

    result = client.table("knowledge_entries").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save decision")

    # Transform response to expected format
    entry = result.data[0]
    decision_id = entry.get("id")

    # Generate AI summary (title, question_summary, decision_summary) immediately
    # This ensures the decision has proper metadata before we log activity
    ai_title = data.title  # fallback to raw title
    try:
        summary_result = await generate_decision_summary_internal(
            decision_id=decision_id,
            company_uuid=company_uuid,
            service_client=get_service_client()
        )
        if summary_result.get("title"):
            ai_title = summary_result["title"]
    except Exception:
        pass  # Summary generation failed, use original title

    decision = {
        "id": decision_id,
        "title": ai_title,
        "content": entry.get("content", ""),
        "content_summary": entry.get("content_summary"),
        "question_summary": entry.get("question_summary"),
        "question": entry.get("question"),
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_ids": entry.get("department_ids", []),
        "project_id": entry.get("project_id"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "created_at": entry.get("created_at"),
        "council_type": entry.get("council_type")
    }

    # Log activity with explicit action field (no title prefix)
    await log_activity(
        company_id=company_uuid,
        event_type="decision",
        action="saved",
        title=ai_title,
        description=data.content[:200] if data.content else None,
        department_id=data.department_id,
        related_id=decision_id,
        related_type="decision",
        conversation_id=data.source_conversation_id,
        message_id=data.source_message_id
    )

    # Auto-regenerate project context if decision is linked to a project
    context_updated = False
    if data.project_id:
        try:
            context_updated = await auto_regenerate_project_context(data.project_id, user)
        except Exception:
            pass  # Non-fatal - decision was saved successfully

    return {"decision": decision, "context_updated": context_updated}


@router.post("/{company_id}/decisions/{decision_id}/promote")
async def promote_decision(company_id: ValidCompanyId, decision_id: ValidDecisionId, data: PromoteDecision, user=Depends(get_current_user)):
    """
    Promote a decision (knowledge entry) to a playbook (SOP/framework/policy).
    Creates a new playbook pre-filled with the decision content.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    import re
    # Use RLS-authenticated client (access control enforced by RLS policies)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get the knowledge entry (decision) - RLS ensures user has access
    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Validate doc_type
    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Auto-generate slug from title if not provided
    base_slug = data.slug
    if not base_slug:
        base_slug = re.sub(r'[^a-z0-9]+', '-', data.title.lower()).strip('-')

    # Ensure slug is unique by checking for existing documents with same slug
    slug = base_slug
    suffix = 1
    while True:
        existing = client.table("org_documents") \
            .select("id") \
            .eq("company_id", company_uuid) \
            .eq("doc_type", data.doc_type) \
            .eq("slug", slug) \
            .execute()

        if not existing.data:
            break  # Slug is unique

        # Append suffix and try again
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    # Get content from knowledge entry
    content = decision.data.get("content", "")

    # Get first department from decision for playbook
    decision_dept_ids = decision.data.get("department_ids") or []
    first_dept_id = decision_dept_ids[0] if decision_dept_ids else None

    # Create the playbook
    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": first_dept_id,
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": slug,
        "summary": data.summary or decision.data.get("content_summary", ""),
        "auto_inject": True
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version with decision content
    client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": content,
        "status": "active",
        "is_current": True,
        "change_summary": f"Promoted from decision: {decision.data['title']}",
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    # Mark the decision as promoted (RLS allows update since user created it or is company owner)
    client.table("knowledge_entries").update({
        "promoted_to_id": doc_id,
        "promoted_to_type": data.doc_type
    }).eq("id", decision_id).execute()

    playbook = doc_result.data[0]
    playbook["content"] = content
    playbook["version"] = 1

    # Log activity - include conversation_id and promoted_to_type for tracking
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        action="promoted",
        title=data.title,
        description=f"Promoted from decision: {decision.data['title']}",
        department_id=decision.data.get("department_ids", [None])[0] if decision.data.get("department_ids") else None,
        related_id=doc_id,
        related_type="playbook",
        conversation_id=decision.data.get("source_conversation_id"),
        promoted_to_type=data.doc_type
    )

    return {
        "playbook": playbook,
        "decision_id": decision_id,
        "promoted": True
    }


@router.get("/{company_id}/decisions/{decision_id}")
async def get_decision(company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """Get a single decision (knowledge entry)."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Query without single/maybe_single to avoid exceptions on 0 rows
    try:
        result = client.table("knowledge_entries") \
            .select("*") \
            .eq("id", decision_id) \
            .eq("company_id", company_uuid) \
            .eq("is_active", True) \
            .execute()
    except Exception as e:
        # Handle any database errors
        raise HTTPException(status_code=404, detail="Resource not found")

    # Check if we got any results
    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Get the first (and should be only) result
    entry = result.data[0]

    # Transform to expected format
    decision = {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": entry.get("content", ""),
        "question": entry.get("question", ""),
        "question_summary": entry.get("question_summary", ""),
        "content_summary": entry.get("content_summary", ""),
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_ids": entry.get("department_ids") or [],
        "project_id": entry.get("project_id"),
        "is_promoted": bool(entry.get("promoted_to_id") or entry.get("project_id")),
        "promoted_to_id": entry.get("promoted_to_id"),
        "promoted_to_type": entry.get("promoted_to_type"),
        "promoted_by_name": entry.get("promoted_by_name"),
        "promoted_at": entry.get("promoted_at"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "response_index": entry.get("response_index"),
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
        "scope": entry.get("scope", "department"),
        "auto_inject": entry.get("auto_inject", False),
        "council_type": entry.get("council_type")
    }

    return {"decision": decision}


@router.post("/{company_id}/decisions/{decision_id}/archive")
async def archive_decision(company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """
    Archive (soft delete) a decision.
    Sets is_active=False rather than permanently deleting.
    Uses POST instead of DELETE for better compatibility.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    # Use RLS-authenticated client (access control enforced by RLS policies)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Verify decision exists and belongs to company, get project_id for sync
    # RLS ensures user can only see decisions they have access to
    check = client.table("knowledge_entries") \
        .select("id, project_id, department_ids") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    project_id = check.data.get("project_id")

    # Soft delete by setting is_active=False (RLS allows update for creator/owner)
    result = client.table("knowledge_entries") \
        .update({"is_active": False}) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to archive decision")

    # Recalculate project's department_ids from remaining active decisions
    if project_id:
        try:
            # Get all remaining active decisions for this project
            remaining = client.table("knowledge_entries") \
                .select("department_ids") \
                .eq("project_id", project_id) \
                .eq("is_active", True) \
                .execute()

            # Collect unique department_ids from all remaining decisions
            all_dept_ids = set()
            for decision in (remaining.data or []):
                dept_ids = decision.get("department_ids") or []
                for did in dept_ids:
                    if did:
                        all_dept_ids.add(did)

            # Update project's department_ids
            client.table("projects") \
                .update({"department_ids": list(all_dept_ids) if all_dept_ids else None}) \
                .eq("id", project_id) \
                .execute()
        except Exception as e:
            # Log but don't fail the archive operation
            log_app_event("ARCHIVE_SYNC_WARNING", details={"project_id": project_id, "error": str(e)})

    return {"success": True, "message": "Decision archived"}


class LinkDecisionToProject(BaseModel):
    project_id: str


@router.post("/{company_id}/decisions/{decision_id}/link-project")
async def link_decision_to_project(company_id: str, decision_id: str, data: LinkDecisionToProject, user=Depends(get_current_user)):
    """
    Link a decision to an existing project.
    Updates the decision's project_id and syncs department_ids.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Verify decision exists - RLS ensures user has access
    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Verify project exists
    project = client.table("projects") \
        .select("id, name, department_ids") \
        .eq("id", data.project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Update decision with project_id (RLS allows update for creator/owner)
    result = client.table("knowledge_entries") \
        .update({
            "project_id": data.project_id,
            "promoted_to_type": "project"
        }) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to link decision to project")

    # Sync project department_ids with decision's departments
    _sync_project_departments_internal(data.project_id)

    # Log activity for linking decision to project
    dept_ids = decision.data.get("department_ids") or []
    await log_activity(
        company_id=company_uuid,
        event_type="project",
        action="promoted",
        title=decision.data.get('title', 'Decision'),
        description=f"Linked to project: {project.data.get('name')}",
        department_id=dept_ids[0] if dept_ids else None,
        related_id=data.project_id,
        related_type="project",
        conversation_id=decision.data.get("source_conversation_id"),
        promoted_to_type="project"
    )

    return {
        "success": True,
        "decision_id": decision_id,
        "project_id": data.project_id,
        "project_name": project.data.get("name")
    }


class CreateProjectFromDecision(BaseModel):
    name: str
    department_ids: Optional[List[str]] = None


@router.post("/{company_id}/decisions/{decision_id}/create-project")
async def create_project_from_decision(company_id: str, decision_id: str, data: CreateProjectFromDecision, user=Depends(get_current_user)):
    """
    Create a new project from a decision.
    Creates the project and links the decision to it.
    Uses Sarah (Project Manager persona) to generate project context from the decision.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Verify decision exists - RLS ensures user has access
    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Use decision's department_ids if none provided
    dept_ids = data.department_ids
    if not dept_ids:
        dept_ids = decision.data.get("department_ids") or []

    # Get user_id properly (user can be dict or object)
    if isinstance(user, dict):
        user_id = user.get('id') or user.get('sub')
    else:
        user_id = getattr(user, 'id', None) or getattr(user, 'sub', None)
    log_app_event("CREATE_PROJECT", "Starting project creation", user_id=user_id)

    if not user_id:
        raise HTTPException(status_code=401, detail="Could not determine user ID from authentication")

    # Generate project context using Sarah
    decision_content = decision.data.get("content") or ""
    user_question = decision.data.get("question") or decision.data.get("title") or ""
    project_name = data.name

    context_md = ""
    description = f"Created from decision: {decision.data.get('title', 'Council Decision')}"

    # Try to generate structured context with Sarah
    try:
        from ..personas import get_db_persona_with_fallback
        from ..openrouter import query_model, MOCK_LLM
        import json as json_module

        if not MOCK_LLM and decision_content:

            # Get Sarah persona from database
            persona = await get_db_persona_with_fallback('sarah')
            system_prompt = persona.get('system_prompt', '')
            models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

            # Parse models if stored as JSON string
            if isinstance(models, str):
                models = json_module.loads(models)

            # Build context from decision
            free_text = f"Project: {project_name}\n\n"
            if user_question:
                free_text += f"Original question: {user_question}\n\n"
            free_text += f"Council decision/insights:\n{decision_content[:4000]}"

            prompt = f"""Create a project brief from this council decision that is being promoted to a project:

"{free_text}"

Return JSON with these exact fields:

{{
  "description": "One sentence describing what this project delivers",
  "context_md": "Well-formatted markdown brief with sections below"
}}

For context_md, use clean markdown formatting. Use these sections (skip any that don't apply):

## Objective
One sentence: what we're building and why.

## Key Insights
- Main takeaways from the council decision

## Deliverables
- Bullet list of concrete outputs

## Success Criteria
- How we know it's done/working

## Technical Notes
Only if relevant technical details were mentioned.

FORMATTING RULES:
- Use ## for section headers
- Use - for bullet points
- Keep it clean and readable

CONTENT RULES:
- Extract from the council decision. Don't invent requirements.
- Be concise. Each section 2-4 bullet points max.
- Skip sections not relevant to the decision."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]

            # Try each model
            for model in models[:2]:  # Try first 2 models max
                try:
                    result = await query_model(model=model, messages=messages)

                    if result and result.get('content'):
                        content = result['content']
                        # Clean up markdown code blocks
                        if content.startswith('```'):
                            content = content.split('```')[1]
                            if content.startswith('json'):
                                content = content[4:]
                        if '```' in content:
                            content = content.split('```')[0]
                        content = content.strip()

                        structured = json_module.loads(content)
                        context_md = structured.get('context_md', '')
                        if structured.get('description'):
                            description = structured['description']
                        break
                except Exception:
                    continue
    except Exception:
        # Fall back to using decision summary as context
        if decision_content:
            context_md = f"## Overview\n\n{decision_content[:2000]}"

    # Create the project with generated context
    project_result = client.table("projects").insert({
        "company_id": company_uuid,
        "user_id": user_id,
        "name": data.name,
        "description": description,
        "context_md": context_md if context_md else None,
        "status": "active",
        "department_ids": dept_ids if dept_ids else [],
        "source_conversation_id": decision.data.get("source_conversation_id"),
        "source": "council"
    }).execute()

    if not project_result.data:
        raise HTTPException(status_code=400, detail="Failed to create project")

    project_id = project_result.data[0]["id"]

    # Update decision with project_id and mark as promoted to project (RLS allows update)
    client.table("knowledge_entries") \
        .update({
            "project_id": project_id,
            "promoted_to_type": "project"
        }) \
        .eq("id", decision_id) \
        .execute()

    # Log activity for creating project from decision
    dept_ids = decision.data.get("department_ids") or []
    await log_activity(
        company_id=company_uuid,
        event_type="project",
        action="promoted",
        title=decision.data.get('title', 'Decision'),
        description=f"Created project: {data.name}",
        department_id=dept_ids[0] if dept_ids else None,
        related_id=project_id,
        related_type="project",
        conversation_id=decision.data.get("source_conversation_id"),
        promoted_to_type="project"
    )

    return {
        "success": True,
        "project": project_result.data[0],
        "decision_id": decision_id
    }


@router.get("/{company_id}/projects/{project_id}/decisions")
async def get_project_decisions(
    company_id: str,
    project_id: str,
    limit: int = 100,
    user=Depends(get_current_user)
):
    """
    Get all decisions linked to a specific project, ordered by date (timeline view).
    Returns decisions as dated entries for project history tracking.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    client = get_client(user)

    # Resolve company UUID
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"decisions": [], "project": None}

    # Verify project exists and belongs to company - RLS ensures access
    project_result = client.table("projects") \
        .select("id, name, description, status, created_at") \
        .eq("id", project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project_result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Get all decisions for this project, ordered by created_at (timeline)
    # RLS ensures user can only see decisions they have access to
    decisions_result = client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    # Get departments for name lookup
    dept_result = client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()
    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    # Transform decisions to expected format
    decisions = []
    for entry in decisions_result.data or []:
        dept_ids = entry.get("department_ids") or []
        first_dept_id = dept_ids[0] if dept_ids else None
        dept_info = dept_map.get(first_dept_id, {}) if first_dept_id else {}

        # Build list of department names
        dept_names = []
        for did in dept_ids:
            d = dept_map.get(did, {})
            if d.get("name"):
                dept_names.append(d.get("name"))

        decisions.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "content": entry.get("content", ""),
            "content_summary": entry.get("content_summary"),
            "question": entry.get("question"),
            "question_summary": entry.get("question_summary"),
            "tags": entry.get("tags", []),
            "category": entry.get("category"),
            "department_ids": dept_ids,
            "department_name": dept_info.get("name"),
            "department_names": dept_names,
            "department_slug": dept_info.get("slug"),
            "source_conversation_id": entry.get("source_conversation_id"),
            "response_index": entry.get("response_index"),
            "created_at": entry.get("created_at"),
            "council_type": entry.get("council_type"),
            "is_promoted": bool(entry.get("promoted_to_id") or entry.get("project_id")),
            "promoted_to_id": entry.get("promoted_to_id")
        })

    return {
        "project": project_result.data,
        "decisions": decisions,
        "total_count": len(decisions)
    }


def _sync_project_departments_internal(project_id: str):
    """
    Internal helper to sync project department_ids from its decisions.
    Uses service client - no auth needed.
    """
    service_client = get_service_client()

    # Get all active decisions for this project
    decisions_result = service_client.table("knowledge_entries") \
        .select("department_ids") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .execute()

    # Collect unique department_ids from all decisions
    all_dept_ids = set()
    for decision in (decisions_result.data or []):
        dept_ids = decision.get("department_ids") or []
        for did in dept_ids:
            if did:
                all_dept_ids.add(did)

    # Update project's department_ids
    updated_dept_ids = list(all_dept_ids) if all_dept_ids else None
    service_client.table("projects") \
        .update({"department_ids": updated_dept_ids}) \
        .eq("id", project_id) \
        .execute()

    return updated_dept_ids


@router.post("/{company_id}/projects/{project_id}/sync-departments")
async def sync_project_departments(company_id: str, project_id: str, user=Depends(get_current_user)):
    """
    Recalculate project's department_ids from all its active decisions.
    Useful for fixing projects that were created before multi-department support.
    """
    service_client = get_service_client()
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Verify project exists
    project_check = service_client.table("projects") \
        .select("id, department_ids") \
        .eq("id", project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project_check.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    updated_dept_ids = _sync_project_departments_internal(project_id)

    return {
        "success": True,
        "project_id": project_id,
        "department_ids": updated_dept_ids
    }


@router.delete("/{company_id}/decisions/{decision_id}")
async def delete_decision(company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """
    Permanently delete a decision.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    # Use RLS-authenticated client (access control enforced by RLS policies)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Verify decision exists and belongs to company - RLS ensures access
    check = client.table("knowledge_entries") \
        .select("id, title") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    decision_title = check.data.get("title", "Decision")

    # Permanently delete the decision (RLS allows delete for creator/owner)
    result = client.table("knowledge_entries") \
        .delete() \
        .eq("id", decision_id) \
        .execute()

    # Log activity for deleted decision
    await log_activity(
        company_id=company_uuid,
        event_type="decision",
        title=f"Deleted: {decision_title}",
        description="Decision was permanently deleted",
        related_id=decision_id,
        related_type="decision"
    )

    # SECURITY: Log decision deletion for audit trail
    current_user_id = user.get('id') if isinstance(user, dict) else user.id
    log_app_event("DECISION_DELETED", "Decision permanently deleted",
                  user_id=current_user_id, resource_id=decision_id)

    return {"success": True, "message": f"Decision '{decision_title}' deleted"}


@router.post("/{company_id}/decisions/{decision_id}/generate-summary")
async def generate_decision_summary(
    company_id: str,
    decision_id: str,
    user=Depends(get_current_user)
):
    """
    Generate an AI summary for a decision - includes title and contextual summary.
    Uses Gemini 2.5 Flash for fast summary generation.
    For multi-turn conversations, includes context from prior decisions.

    This endpoint is for on-demand regeneration (e.g., if user wants to refresh).
    New decisions should have summaries generated at save time.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    # Use RLS-authenticated client (access control enforced by RLS policies)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Check if we already have a good cached summary - RLS ensures access
    result = client.table("knowledge_entries") \
        .select("id, title, content_summary") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    existing_summary = result.data.get("content_summary")

    # Check if existing summary is good (not garbage, not too short, not truncated)
    garbage_summaries = [
        "added council decision to project",
        "decision merged into project",
        "added new council decision section"
    ]

    if existing_summary:
        is_garbage = existing_summary.lower().strip() in garbage_summaries
        is_too_short = len(existing_summary) < 100
        is_truncated = existing_summary.rstrip().endswith("...")

        if not is_garbage and not is_too_short and not is_truncated:
            return {"summary": existing_summary, "title": result.data.get("title"), "cached": True}

    # Generate new summary using the internal function (needs service client for writes)
    service_client = get_service_client()
    return await generate_decision_summary_internal(decision_id, company_uuid, service_client)


# ============================================
# ACTIVITY ENDPOINTS
# ============================================

@router.get("/{company_id}/activity")
async def get_activity_logs(
    company_id: str,
    limit: int = 50,
    event_type: Optional[str] = None,
    days: Optional[int] = None,
    user=Depends(get_current_user)
):
    """
    Get activity logs for a company.
    Optional filter by event_type (decision, playbook, role, department, council_session).
    Optional filter by days (1 = today, 7 = last week, 30 = last month).

    Automatically filters out orphaned entries (referencing deleted items).
    """
    # Use service client for read operations
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"logs": [], "playbook_ids": [], "decision_ids": []}

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Fetch more than requested to account for filtering orphans
    fetch_limit = limit * 2

    query = client.table("activity_logs") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("created_at", desc=True) \
        .limit(fetch_limit)

    if event_type:
        query = query.eq("event_type", event_type)

    # Filter by date range if specified
    if days:
        from datetime import datetime, timedelta
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        query = query.gte("created_at", cutoff)

    result = query.execute()
    all_logs = result.data or []

    # Collect IDs to check for existence (batch queries for efficiency)
    decision_ids_to_check = set()
    playbook_ids_to_check = set()
    project_ids_to_check = set()

    for log in all_logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")
        if related_id and related_type:
            if related_type == "decision":
                decision_ids_to_check.add(related_id)
            elif related_type == "playbook":
                playbook_ids_to_check.add(related_id)
            elif related_type == "project":
                project_ids_to_check.add(related_id)

    # Batch check existence
    existing_decisions = set()
    existing_playbooks = set()
    existing_projects = set()

    # Also fetch promoted_to_type to enrich activity logs with current state
    decision_promoted_types = {}
    if decision_ids_to_check:
        try:
            result = client.table("knowledge_entries") \
                .select("id, promoted_to_type, project_id") \
                .in_("id", list(decision_ids_to_check)) \
                .eq("is_active", True) \
                .execute()
            for r in (result.data or []):
                existing_decisions.add(r["id"])
                # Set promoted_to_type - prefer stored value, fall back to 'project' if has project_id
                if r.get("promoted_to_type"):
                    decision_promoted_types[r["id"]] = r["promoted_to_type"]
                elif r.get("project_id"):
                    decision_promoted_types[r["id"]] = "project"
        except Exception:
            existing_decisions = decision_ids_to_check  # Assume all exist on error

    if playbook_ids_to_check:
        try:
            # Correct table is org_documents, not playbooks
            result = client.table("org_documents") \
                .select("id") \
                .in_("id", list(playbook_ids_to_check)) \
                .eq("is_active", True) \
                .execute()
            existing_playbooks = {r["id"] for r in (result.data or [])}
        except Exception:
            existing_playbooks = playbook_ids_to_check

    if project_ids_to_check:
        try:
            result = client.table("projects") \
                .select("id") \
                .in_("id", list(project_ids_to_check)) \
                .execute()
            existing_projects = {r["id"] for r in (result.data or [])}
        except Exception:
            existing_projects = project_ids_to_check

    # Filter out orphaned logs and enrich with current state
    valid_logs = []
    orphaned_ids = []
    for log in all_logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")

        # Keep logs without related items (e.g., general events)
        if not related_id or not related_type:
            valid_logs.append(log)
            continue

        # Check if related item exists
        exists = True
        if related_type == "decision":
            exists = related_id in existing_decisions
            # Enrich with current promoted_to_type (decision may have been promoted since activity was logged)
            if exists and related_id in decision_promoted_types:
                log = {**log, "promoted_to_type": decision_promoted_types[related_id]}
        elif related_type == "playbook":
            exists = related_id in existing_playbooks
        elif related_type == "project":
            exists = related_id in existing_projects
            # For project-type activities, ensure promoted_to_type is set
            if exists and not log.get("promoted_to_type"):
                log = {**log, "promoted_to_type": "project"}

        if exists:
            valid_logs.append(log)
        else:
            orphaned_ids.append(log["id"])

    # Auto-cleanup orphaned logs in background (don't wait)
    if orphaned_ids:
        try:
            for log_id in orphaned_ids:
                client.table("activity_logs").delete().eq("id", log_id).execute()
        except Exception:
            pass  # Non-critical cleanup

    # Return only up to the requested limit
    logs = valid_logs[:limit]

    # Extract unique related IDs for navigation
    playbook_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "playbook" and log.get("related_id")
    ))
    decision_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "decision" and log.get("related_id")
    ))

    return {"logs": logs, "playbook_ids": playbook_ids, "decision_ids": decision_ids}


@router.delete("/{company_id}/activity/cleanup")
async def cleanup_orphaned_activity_logs(company_id: str, user=Depends(get_current_user)):
    """
    Remove activity log entries that reference non-existent items.
    This helps clean up the Activity tab when referenced items have been deleted.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"deleted_count": 0, "message": "Company not found"}

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Get all activity logs for this company
    logs_result = client.table("activity_logs") \
        .select("id, related_id, related_type") \
        .eq("company_id", company_uuid) \
        .execute()

    logs = logs_result.data or []
    orphaned_ids = []

    for log in logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")

        # Skip logs without related items
        if not related_id or not related_type:
            continue

        # Check if the related item exists
        exists = False
        try:
            if related_type == "decision":
                result = client.table("knowledge_entries") \
                    .select("id") \
                    .eq("id", related_id) \
                    .eq("is_active", True) \
                    .execute()
                exists = len(result.data) > 0 if result.data else False
            elif related_type == "playbook":
                # Correct table is org_documents, not playbooks
                result = client.table("org_documents") \
                    .select("id") \
                    .eq("id", related_id) \
                    .eq("is_active", True) \
                    .execute()
                exists = len(result.data) > 0 if result.data else False
            elif related_type == "project":
                result = client.table("projects") \
                    .select("id") \
                    .eq("id", related_id) \
                    .execute()
                exists = len(result.data) > 0 if result.data else False
            else:
                # Unknown type - keep the log
                exists = True
        except Exception:
            # If check fails, keep the log to be safe
            exists = True

        if not exists:
            orphaned_ids.append(log["id"])

    # Delete orphaned logs
    deleted_count = 0
    if orphaned_ids:
        for log_id in orphaned_ids:
            try:
                client.table("activity_logs").delete().eq("id", log_id).execute()
                deleted_count += 1
            except Exception:
                pass  # Continue cleaning other logs

    return {
        "deleted_count": deleted_count,
        "total_checked": len(logs),
        "message": f"Cleaned up {deleted_count} orphaned activity logs"
    }


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

    Args:
        company_id: Company UUID
        event_type: Type of event (decision, playbook, role, department, council_session)
        title: Short title for the activity (clean, no action prefix)
        action: Explicit action type (saved, promoted, deleted, created, updated, archived)
        description: Optional longer description
        department_id: Optional department UUID
        related_id: Optional UUID of related entity
        related_type: Optional type of related entity (playbook, decision, project)
        conversation_id: Optional UUID of source conversation (for tracing back to council discussion)
        message_id: Optional UUID of specific message in conversation
        promoted_to_type: Optional type promoted to (sop, framework, policy, project)
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

    # Only add promoted_to_type if provided (avoids null constraint issues)
    if promoted_to_type:
        data["promoted_to_type"] = promoted_to_type

    try:
        client.table("activity_logs").insert(data).execute()
    except Exception:
        pass  # Don't fail the main operation if logging fails


# ============================================
# TEAM MEMBERS ENDPOINTS
# ============================================
# Per Council recommendation: Simple team management
# - Single owner per company
# - Roles: owner, admin, member
# - No email sending yet - manual addition only

class MemberInvite(BaseModel):
    """Invite a new member to the company."""
    email: str
    role: str = "member"  # 'admin' or 'member' (owner is special)


class MemberUpdate(BaseModel):
    """Update a member's role."""
    role: str  # 'admin' or 'member' (can't change to/from owner via API)


class UsageStats(BaseModel):
    """Usage statistics for billing dashboard."""
    total_sessions: int
    total_tokens_input: int
    total_tokens_output: int
    sessions_this_month: int
    tokens_this_month_input: int
    tokens_this_month_output: int


@router.get("/{company_id}/members")
async def get_company_members(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get all members of the company with their roles.
    Any company member can view the member list.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Get all members with their user info
    result = client.table("company_members") \
        .select("id, user_id, role, joined_at, created_at") \
        .eq("company_id", company_uuid) \
        .order("created_at") \
        .execute()

    if not result.data:
        return {"members": []}

    # Get user emails from auth.users via RPC or direct query
    # Since we can't directly query auth.users, we'll return user_ids
    # Frontend can match with current user or we add a users view later
    members = []
    for member in result.data:
        members.append({
            "id": member["id"],
            "user_id": member["user_id"],
            "role": member["role"],
            "joined_at": member["joined_at"],
            "created_at": member["created_at"]
        })

    return {"members": members}


@router.post("/{company_id}/members")
async def add_company_member(company_id: ValidCompanyId, data: MemberInvite, user=Depends(get_current_user)):
    """
    Add a new member to the company.
    Only owners and admins can add members.

    For MVP: Directly adds member by user_id (assumes user already exists in auth.users).
    Future: Will use invitation system with email.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Get current user's role in this company
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        log_security_event("ACCESS_DENIED", user_id=current_user_id,
                          resource_type="company_members", resource_id=company_uuid,
                          details={"action": "add_member"}, severity="WARNING")
        raise HTTPException(status_code=403, detail="Only owners and admins can add members")

    # Validate role
    if data.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    # Look up user by email in auth.users
    # Using service client to access auth schema
    user_result = client.rpc("get_user_id_by_email", {"user_email": data.email}).execute()

    if not user_result.data:
        raise HTTPException(
            status_code=404,
            detail=f"No user found with email: {data.email}. They must sign up first."
        )

    new_user_id = user_result.data

    # Check if already a member
    existing = client.table("company_members") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", new_user_id) \
        .execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="User is already a member of this company")

    # Add the member
    result = client.table("company_members").insert({
        "company_id": company_uuid,
        "user_id": new_user_id,
        "role": data.role,
        "invited_by": current_user_id
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add member")

    # Log the activity
    await log_activity(
        company_id=company_uuid,
        event_type="member_added",
        title=f"Added new {data.role}",
        description=f"Added user as {data.role}"
    )

    # SECURITY: Log member addition for audit trail
    log_app_event("MEMBER_ADDED", "New member added to company",
                  user_id=current_user_id, resource_id=company_uuid,
                  role=data.role)

    return {"member": result.data[0], "message": f"Member added successfully as {data.role}"}


@router.patch("/{company_id}/members/{member_id}")
async def update_company_member(
    company_id: ValidCompanyId,
    member_id: str,
    data: MemberUpdate,
    user=Depends(get_current_user)
):
    """
    Update a member's role.
    - Owners can change anyone's role (except their own owner status)
    - Admins can only change member roles (not other admins or owner)
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Validate role
    if data.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    # Get current user's role
    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can update members")

    my_role = my_membership.data["role"]

    # Get target member's current role
    target = client.table("company_members") \
        .select("id, role, user_id") \
        .eq("id", member_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found")

    target_role = target.data["role"]

    # Permission checks
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot change owner's role")

    if my_role == "admin" and target_role == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot modify other admins")

    # Update the role
    result = client.table("company_members") \
        .update({"role": data.role}) \
        .eq("id", member_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update member")

    await log_activity(
        company_id=company_uuid,
        event_type="member_updated",
        title=f"Changed role to {data.role}",
        description=f"Member role changed from {target_role} to {data.role}"
    )

    return {"member": result.data[0], "message": f"Role updated to {data.role}"}


@router.delete("/{company_id}/members/{member_id}")
async def remove_company_member(company_id: ValidCompanyId, member_id: str, user=Depends(get_current_user)):
    """
    Remove a member from the company.
    - Owners can remove anyone except themselves
    - Admins can only remove regular members
    - Members cannot remove anyone
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    # Get current user's role
    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        log_security_event("ACCESS_DENIED", user_id=current_user_id,
                          resource_type="company_members", resource_id=company_uuid,
                          details={"action": "remove_member"}, severity="WARNING")
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    my_role = my_membership.data["role"]

    # Get target member
    target = client.table("company_members") \
        .select("id, role, user_id") \
        .eq("id", member_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found")

    target_role = target.data["role"]
    target_user_id = target.data["user_id"]

    # Permission checks
    if target_user_id == current_user_id:
        raise HTTPException(status_code=403, detail="Cannot remove yourself")

    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove the owner")

    if my_role == "admin" and target_role == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot remove other admins")

    # Remove the member
    client.table("company_members") \
        .delete() \
        .eq("id", member_id) \
        .execute()

    await log_activity(
        company_id=company_uuid,
        event_type="member_removed",
        title=f"Removed {target_role}",
        description=f"Member with role {target_role} was removed"
    )

    # SECURITY: Log member removal for audit trail
    log_app_event("MEMBER_REMOVED", "Member removed from company",
                  user_id=current_user_id, resource_id=company_uuid,
                  target_role=target_role)

    return {"message": "Member removed successfully"}


# ============================================
# USAGE TRACKING ENDPOINTS
# ============================================
# Per Council recommendation: Privacy by design
# - Aggregate usage only (no user_id tracking)
# - Only owners/admins can view usage

@router.get("/{company_id}/usage")
async def get_company_usage(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get usage statistics for the company.
    Only owners and admins can view usage data.

    Returns aggregate data only - no user-level breakdown (privacy by design).
    """
    from datetime import datetime

    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Check if user is owner or admin
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    try:
        my_membership = client.table("company_members") \
            .select("role") \
            .eq("company_id", company_uuid) \
            .eq("user_id", current_user_id) \
            .maybe_single() \
            .execute()

        if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail="Only owners and admins can view usage")
    except HTTPException:
        raise
    except Exception:
        # company_members table might not exist yet, fall back to owner check
        try:
            company_check = client.table("companies") \
                .select("user_id") \
                .eq("id", company_uuid) \
                .maybe_single() \
                .execute()
            if not company_check.data or company_check.data.get("user_id") != current_user_id:
                raise HTTPException(status_code=403, detail="Only owners and admins can view usage")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=403, detail="Only owners and admins can view usage")

    # Get usage data - handle case where usage_events table might not exist
    try:
        # Get all-time usage
        all_time = client.table("usage_events") \
            .select("id, tokens_input, tokens_output") \
            .eq("company_id", company_uuid) \
            .execute()

        total_sessions = len(all_time.data) if all_time.data else 0
        total_input = sum(e.get("tokens_input", 0) or 0 for e in (all_time.data or []))
        total_output = sum(e.get("tokens_output", 0) or 0 for e in (all_time.data or []))

        # Get this month's usage
        first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        this_month = client.table("usage_events") \
            .select("id, tokens_input, tokens_output") \
            .eq("company_id", company_uuid) \
            .gte("created_at", first_of_month.isoformat()) \
            .execute()

        month_sessions = len(this_month.data) if this_month.data else 0
        month_input = sum(e.get("tokens_input", 0) or 0 for e in (this_month.data or []))
        month_output = sum(e.get("tokens_output", 0) or 0 for e in (this_month.data or []))
    except Exception:
        # usage_events table might not exist yet - return zeros
        total_sessions = 0
        total_input = 0
        total_output = 0
        month_sessions = 0
        month_input = 0
        month_output = 0

    return {
        "usage": {
            "total_sessions": total_sessions,
            "total_tokens_input": total_input,
            "total_tokens_output": total_output,
            "sessions_this_month": month_sessions,
            "tokens_this_month_input": month_input,
            "tokens_this_month_output": month_output
        }
    }


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
    Usage is aggregated at company level only.

    Args:
        company_id: Company UUID
        event_type: Type of event (council_session, document_created, decision_saved)
        tokens_input: Number of input tokens used
        tokens_output: Number of output tokens generated
        model_used: Model identifier (e.g., 'anthropic/claude-3-opus')
        session_id: Optional session/conversation UUID
        metadata: Optional additional metadata (JSON)
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
