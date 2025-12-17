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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import re
from functools import lru_cache
import time

from ..auth import get_current_user
from ..database import get_supabase_with_auth, get_supabase_service


router = APIRouter(prefix="/api/company", tags=["company"])

# UUID pattern for validation
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

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
    decision_summary: Optional[str] = None  # Brief summary for quick scanning


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


async def auto_regenerate_project_context(project_id: str, user: dict) -> bool:
    """
    Automatically regenerate project context when a decision is saved.
    This synthesizes ALL decisions into the project context.

    Returns True if context was updated, False otherwise.
    """
    from ..openrouter import query_model, MOCK_LLM
    from datetime import datetime
    import json

    print(f"[AUTO-SYNTH] Regenerating context for project {project_id}", flush=True)

    service_client = get_service_client()

    # Get project details
    project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
    if not project_result.data:
        print(f"[AUTO-SYNTH] Project not found: {project_id}", flush=True)
        return False

    project = project_result.data

    # Get ALL decisions for this project
    decisions_result = service_client.table("knowledge_entries") \
        .select("id, title, body_md, summary, created_at, department_id") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=False) \
        .execute()

    decisions = decisions_result.data or []

    if not decisions:
        print(f"[AUTO-SYNTH] No decisions for project {project_id}", flush=True)
        return False

    print(f"[AUTO-SYNTH] Found {len(decisions)} decisions to synthesize", flush=True)

    # Handle mock mode
    if MOCK_LLM:
        print("[AUTO-SYNTH] MOCK mode - skipping AI synthesis", flush=True)
        mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nAuto-synthesized from {len(decisions)} decisions."
        service_client.table("projects").update({
            "context_md": mock_context,
            "updated_at": datetime.now().isoformat()
        }).eq("id", project_id).execute()
        return True

    # Build decisions summary for LLM
    decisions_summary = ""
    for i, d in enumerate(decisions, 1):
        date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
        title = d.get("title", "Untitled")
        content = d.get("summary") or (d.get("body_md", "")[:1000] + "..." if len(d.get("body_md", "")) > 1000 else d.get("body_md", ""))
        decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n{content}\n"

    today_date = datetime.now().strftime("%B %d, %Y")

    prompt = f"""You are Sarah, an experienced Project Manager. Your job is to create a CLEAN, WELL-ORGANIZED project document.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## ALL DECISIONS MADE FOR THIS PROJECT
{decisions_summary}

---

## YOUR TASK

Create a single, clean project document that:
1. Starts with a clear project overview (what is this project? who is it for?)
2. Synthesizes ALL the decisions into organized sections
3. ELIMINATES ALL DUPLICATES - if the same insight appears multiple times, include it ONCE
4. Uses clear, simple language anyone can understand
5. Includes a "Decision Log" section with dates

## DOCUMENTATION STYLE RULES

✅ DO:
- Write a clear 1-2 sentence summary at the top
- Group related decisions together
- Use bullet points for action items
- Include dates for key decisions
- Make it readable by someone new to the project

❌ DON'T:
- Include duplicate content (very important!)
- Use vague language
- Include raw LLM output or "Chairman's Synthesis" headers
- Leave any section empty

## OUTPUT FORMAT

Return valid JSON:
{{
  "context_md": "The complete project documentation in markdown",
  "sections_count": <number of main sections>,
  "decisions_incorporated": <number of decisions you incorporated>
}}

Today's date: {today_date}"""

    messages = [
        {"role": "system", "content": "You are Sarah, a senior Project Manager. Create clean, well-organized project documentation. NEVER include duplicate content. Respond only with valid JSON."},
        {"role": "user", "content": prompt}
    ]

    # Use fast models for auto-synthesis
    SYNTH_MODELS = [
        "google/gemini-2.0-flash-001",
        "anthropic/claude-3-5-haiku-20241022",
        "openai/gpt-4o-mini",
    ]

    result_data = None
    last_error = None

    for model in SYNTH_MODELS:
        try:
            print(f"[AUTO-SYNTH] Trying model: {model}", flush=True)
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
                    print(f"[AUTO-SYNTH] Success with {model}", flush=True)
                    break
                except json.JSONDecodeError as e:
                    last_error = f"JSON parse error from {model}: {e}"
                    print(f"[AUTO-SYNTH] {last_error}", flush=True)
                    continue
            else:
                last_error = f"No response from {model}"
                print(f"[AUTO-SYNTH] {last_error}", flush=True)
                continue
        except Exception as e:
            last_error = f"{model} failed: {type(e).__name__}: {e}"
            print(f"[AUTO-SYNTH] {last_error}", flush=True)
            continue

    if result_data is None:
        print(f"[AUTO-SYNTH] All models failed. Last error: {last_error}", flush=True)
        return False

    new_context = result_data.get("context_md", "")

    # Update the project with new context
    service_client.table("projects").update({
        "context_md": new_context,
        "updated_at": datetime.now().isoformat()
    }).eq("id", project_id).execute()

    print(f"[AUTO-SYNTH] Updated project context with {len(decisions)} decisions incorporated", flush=True)
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
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

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
    Uses Sarah (Project Manager persona) with Gemini 2.5 Flash.
    For multi-turn conversations, includes context from prior decisions.

    This is the core logic, extracted so it can be called from both:
    1. The API endpoint (on-demand regeneration)
    2. The merge endpoint (at save time)

    Returns: {"summary": str, "title": str, "cached": bool}
    """
    print(f"[SUMMARY] generate_decision_summary_internal called with decision_id={decision_id}, company_uuid={company_uuid}", flush=True)

    from ..openrouter import query_model, MOCK_LLM
    print(f"[SUMMARY] MOCK_LLM={MOCK_LLM}", flush=True)

    if service_client is None:
        service_client = get_service_client()

    # Get the decision with conversation info AND content (council response)
    # Note: The council response is stored in body_md, not content
    result = service_client.table("knowledge_entries") \
        .select("id, user_question, body_md, title, summary, decision_summary, source_conversation_id, response_index, created_at") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        return {"summary": "Decision not found", "title": "Unknown", "cached": False}

    decision = result.data
    user_question = decision.get("user_question", "")
    council_response = decision.get("body_md", "")
    conversation_id = decision.get("source_conversation_id")
    response_index = decision.get("response_index", 0) or 0

    # If no user_question, can't generate a meaningful summary
    if not user_question:
        return {"summary": "No question recorded for this decision.", "title": decision.get("title"), "cached": False}

    # Fetch prior decisions from the same conversation for context
    prior_context = ""
    if conversation_id and response_index > 0:
        try:
            prior_result = service_client.table("knowledge_entries") \
                .select("user_question, body_md, decision_summary, title, response_index") \
                .eq("source_conversation_id", conversation_id) \
                .eq("company_id", company_uuid) \
                .lt("response_index", response_index) \
                .order("response_index") \
                .execute()

            if prior_result.data:
                prior_items = []
                for prior in prior_result.data:
                    idx = prior.get("response_index", 0) or 0
                    prior_q = prior.get("user_question", "")
                    prior_title = prior.get("title", "")
                    prior_response = prior.get("body_md", "")
                    prior_summary = prior.get("decision_summary", "")

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
            print(f"[SUMMARY] Failed to fetch prior decisions: {e}", flush=True)

    # Handle mock mode
    if MOCK_LLM:
        mock_title = f"Decision about {user_question[:30]}..."
        mock_summary = f"The user asked about {user_question[:100]}..."
        return {"summary": mock_summary, "title": mock_title, "cached": False}

    # Build the prompt for Sarah (Project Manager)
    council_excerpt = council_response[:2500] if council_response else ""

    # Different prompts for first decision vs follow-up decisions
    if prior_context and response_index > 0:
        prompt = f"""You are Sarah, an experienced Project Manager documenting a multi-turn conversation with an AI council.

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
   - NOT just "User Engagement" or "Wait Times" (too vague, doesn't show follow-up)

2. **SUMMARY** (4-6 sentences): MUST answer these questions:
   - What did the user ask the council to do differently this time?
   - What new perspective or expertise were they seeking?
   - What key new insights did the council provide?
   - How does this build on or differ from the previous decision?

## OUTPUT FORMAT
TITLE: [your specific follow-up title]

SUMMARY: [your complete 4-6 sentence summary explaining the follow-up and new insights]

CRITICAL: The summary must make clear this is a FOLLOW-UP. Someone reading it should understand what changed from the previous decision."""
    else:
        prompt = f"""You are Sarah, an experienced Project Manager. Document this council decision clearly.

## THE USER'S QUESTION:
{user_question}

## THE COUNCIL'S RESPONSE:
{council_excerpt}

## YOUR TASK
Generate TWO things:

1. **TITLE** (4-8 words): Specific title capturing the decision topic.
   - BAD: "User Engagement" (too vague)
   - GOOD: "Wait Time Engagement via Progress Indicators"
   - GOOD: "CTO Council: Reducing Perceived Wait Time"

2. **SUMMARY** (3-5 sentences): A complete summary that answers:
   - What specific problem did the user bring to the council?
   - What was the council's key recommendation?
   - What specific approach or strategy did they suggest?

## OUTPUT FORMAT
TITLE: [your specific title]

SUMMARY: [your 3-5 sentence summary]

CRITICAL: Write for someone who has never seen this project. Be specific about what was decided."""

    try:
        response = await query_model(
            "google/gemini-2.5-flash",
            [{"role": "user", "content": prompt}]
        )

        content = response.get("content", "").strip() if response else ""
        print(f"[SUMMARY] Gemini response: {content[:200]}...", flush=True)

        # Parse the response
        generated_title = decision.get("title")
        generated_summary = ""

        if "TITLE:" in content and "SUMMARY:" in content:
            parts = content.split("SUMMARY:")
            title_part = parts[0].replace("TITLE:", "").strip()
            summary_part = parts[1].strip() if len(parts) > 1 else ""

            if title_part:
                generated_title = title_part.strip()
            if summary_part:
                generated_summary = summary_part.strip()
        else:
            generated_summary = content

        if generated_summary:
            # Save both title and summary in the database
            update_data = {"decision_summary": generated_summary}
            if generated_title and generated_title != decision.get("title"):
                update_data["title"] = generated_title
                print(f"[SUMMARY] Updating title from '{decision.get('title')[:50]}...' to '{generated_title[:50]}...'", flush=True)

            print(f"[SUMMARY] Saving to database: {list(update_data.keys())}", flush=True)
            update_result = service_client.table("knowledge_entries") \
                .update(update_data) \
                .eq("id", decision_id) \
                .execute()
            print(f"[SUMMARY] Database update result: {len(update_result.data) if update_result.data else 0} rows", flush=True)

            return {"summary": generated_summary, "title": generated_title, "cached": False}
        else:
            print(f"[SUMMARY] No summary generated, falling back to user question", flush=True)
            return {"summary": user_question[:300], "title": decision.get("title"), "cached": False}

    except Exception as e:
        import traceback
        print(f"[SUMMARY] Failed to generate summary: {e}", flush=True)
        print(f"[SUMMARY] Traceback: {traceback.format_exc()}", flush=True)
        return {"summary": user_question[:300], "title": decision.get("title"), "cached": False}


# ============================================
# OVERVIEW ENDPOINTS
# ============================================

@router.get("/{company_id}/overview")
async def get_company_overview(company_id: str, user=Depends(get_current_user)):
    """
    Get company overview with stats from DATABASE.
    Returns company info + counts of departments, roles, playbooks, decisions.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    # Get company details from database
    company_result = client.table("companies") \
        .select("*") \
        .eq("id", company_uuid) \
        .single() \
        .execute()

    if not company_result.data:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

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

    return {
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


class CompanyContextUpdate(BaseModel):
    """Update company context."""
    context_md: str


@router.put("/{company_id}/context")
async def update_company_context(company_id: str, data: CompanyContextUpdate, user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    # Update the company's context_md
    result = client.table("companies") \
        .update({
            "context_md": data.context_md
        }) \
        .eq("id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Company not found")

    return {"company": result.data[0]}


# ============================================
# TEAM ENDPOINTS (Departments & Roles)
# ============================================

@router.get("/{company_id}/team")
async def get_team(company_id: str, user=Depends(get_current_user)):
    """
    Get all departments with their roles from DATABASE.
    Returns hierarchical structure: departments → roles.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

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
    result = []
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

        result.append(dept_data)

    return {"departments": result}


@router.post("/{company_id}/departments")
async def create_department(company_id: str, data: DepartmentCreate, user=Depends(get_current_user)):
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

    return {"department": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}")
async def update_department(company_id: str, dept_id: str, data: DepartmentUpdate, user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail="Department not found")

    return {"department": result.data[0]}


@router.post("/{company_id}/departments/{dept_id}/roles")
async def create_role(company_id: str, dept_id: str, data: RoleCreate, user=Depends(get_current_user)):
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

    return {"role": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def update_role(company_id: str, dept_id: str, role_id: str, data: RoleUpdate, user=Depends(get_current_user)):
    """Update a role."""
    client = get_client(user)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("roles") \
        .update(update_data) \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")

    return {"role": result.data[0]}


@router.get("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def get_role(company_id: str, dept_id: str, role_id: str, user=Depends(get_current_user)):
    """Get a single role with full details including system prompt."""
    client = get_client(user)

    result = client.table("roles") \
        .select("*") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")

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


@router.post("/{company_id}/playbooks")
async def create_playbook(company_id: str, data: PlaybookCreate, user=Depends(get_current_user)):
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
async def update_playbook(company_id: str, playbook_id: str, data: PlaybookUpdate, user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail="Playbook not found")

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
    # Use service client to bypass RLS for junction table operations
    if data.additional_departments is not None:
        service_client = get_supabase_service()
        if service_client:
            # Delete all existing mappings
            service_client.table("org_document_departments") \
                .delete() \
                .eq("document_id", playbook_id) \
                .execute()

            # Insert new mappings
            if data.additional_departments:
                dept_mappings = [
                    {"document_id": playbook_id, "department_id": dept_id}
                    for dept_id in data.additional_departments
                ]
                service_client.table("org_document_departments").insert(dept_mappings).execute()

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
async def delete_playbook(company_id: str, playbook_id: str, user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail="Playbook not found")

    playbook_title = existing.data.get("title", "Playbook")

    # Delete department mappings first (foreign key constraint)
    service_client = get_supabase_service()
    if service_client:
        service_client.table("org_document_departments") \
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

    # Log activity
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Deleted: {playbook_title}",
        description="Playbook was permanently deleted"
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
        # Search in title and summary
        query = query.or_(f"title.ilike.%{search}%,summary.ilike.%{search}%")

    result = query.order("created_at", desc=True).limit(limit).execute()

    # Transform to expected format for frontend compatibility
    decisions = []
    for entry in result.data or []:
        dept_id = entry.get("department_id")
        dept_ids = entry.get("department_ids") or ([dept_id] if dept_id else [])
        dept_info = dept_map.get(dept_id, {}) if dept_id else {}

        # Use body_md if available, fall back to summary for legacy data
        body_md = entry.get("body_md", "")
        content = body_md if body_md else entry.get("summary", "")

        decisions.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "content": content,  # Full council response from body_md (with summary fallback)
            "user_question": entry.get("user_question", ""),  # User question for context
            "decision_summary": entry.get("decision_summary", ""),  # AI-generated summary
            "tags": entry.get("tags", []),
            "category": entry.get("category"),
            "department_id": dept_id,  # Primary for backwards compat
            "department_ids": dept_ids,  # All departments (multi-department support)
            "department_name": dept_info.get("name"),  # Embedded for display
            "department_slug": dept_info.get("slug"),  # Embedded for filtering
            "project_id": entry.get("project_id"),
            "is_promoted": entry.get("is_promoted", False),
            "promoted_to_id": entry.get("promoted_to_id"),
            "promoted_to_type": entry.get("promoted_to_type"),  # sop/framework/policy
            "promoted_by_name": entry.get("promoted_by_name"),  # Who promoted it
            "promoted_at": entry.get("promoted_at"),  # When it was promoted
            "source_conversation_id": entry.get("source_conversation_id"),
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
async def create_decision(company_id: str, data: DecisionCreate, user=Depends(get_current_user)):
    """
    Save a new decision from a council session.
    Now stores in knowledge_entries table for unified knowledge management.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get user_id for created_by field
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # Build insert data
    insert_data = {
        "company_id": company_uuid,
        "department_id": data.department_id,
        "title": data.title,
        "summary": data.content,  # Map content to summary (full response)
        "decision_summary": data.decision_summary,  # Brief summary for quick scanning
        "category": "technical_decision",  # Default category
        "source_conversation_id": data.source_conversation_id,
        "source_message_id": data.source_message_id,
        "tags": data.tags,
        "created_by": user_id,
        "is_active": True,
        "scope": "project" if data.project_id else "department",  # Project-scoped if linked
        "auto_inject": False,  # User can enable later
        "user_question": data.user_question  # Store the original question
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
    # Use body_md if available, fall back to summary for legacy data
    body_md = entry.get("body_md", "")
    content = body_md if body_md else entry.get("summary", "")

    decision = {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": content,  # Full council response from body_md (with summary fallback)
        "decision_summary": entry.get("decision_summary"),
        "user_question": entry.get("user_question"),
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_id": entry.get("department_id"),
        "project_id": entry.get("project_id"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "created_at": entry.get("created_at"),
        "council_type": entry.get("council_type")
    }

    # Log activity for the new decision
    await log_activity(
        company_id=company_uuid,
        event_type="decision",
        title=f"Saved: {data.title}",
        description=data.content[:200] if data.content else None,
        department_id=data.department_id,
        related_id=entry.get("id"),
        related_type="decision",
        conversation_id=data.source_conversation_id,
        message_id=data.source_message_id
    )

    # Auto-regenerate project context if decision is linked to a project
    context_updated = False
    if data.project_id:
        try:
            print(f"[AUTO-SYNTH] Starting auto-synthesis for project {data.project_id}", flush=True)
            context_updated = await auto_regenerate_project_context(data.project_id, user)
            print(f"[AUTO-SYNTH] Auto-synthesis completed: {context_updated}", flush=True)
        except Exception as e:
            # Non-fatal - decision was saved, just log the error
            print(f"[AUTO-SYNTH] Failed to auto-regenerate context (non-fatal): {e}", flush=True)

    return {"decision": decision, "context_updated": context_updated}


@router.post("/{company_id}/decisions/{decision_id}/promote")
async def promote_decision(company_id: str, decision_id: str, data: PromoteDecision, user=Depends(get_current_user)):
    """
    Promote a decision (knowledge entry) to a playbook (SOP/framework/policy).
    Creates a new playbook pre-filled with the decision content.

    Uses service client for knowledge_entries to bypass RLS.
    """
    import re
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # User client for company resolution and other tables
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Get the knowledge entry (decision) - using service client to bypass RLS
    decision = service_client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Decision not found")

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
        existing = user_client.table("org_documents") \
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

    # Get content from knowledge entry (use summary as content)
    content = decision.data.get("summary", "") or decision.data.get("body_md", "") or ""

    # Create the playbook (user_client for org_documents)
    doc_result = user_client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": decision.data.get("department_id"),
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": slug,
        "summary": data.summary or decision.data.get("summary", ""),
        "auto_inject": True
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version with decision content (user_client for versions)
    user_client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": content,
        "status": "active",
        "is_current": True,
        "change_summary": f"Promoted from decision: {decision.data['title']}",
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    # NOTE: Marking decision as "promoted" is skipped because the knowledge_entries
    # table doesn't have the required columns (is_promoted, promoted_to_id, promoted_to_type).
    # The playbook is created successfully regardless.

    playbook = doc_result.data[0]
    playbook["content"] = content
    playbook["version"] = 1

    # Log activity - include conversation_id if decision has one
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Promoted: {data.title}",
        description=f"Promoted from decision: {decision.data['title']}",
        department_id=decision.data.get("department_id"),
        related_id=doc_id,
        related_type="playbook",
        conversation_id=decision.data.get("source_conversation_id")
    )

    return {
        "playbook": playbook,
        "decision_id": decision_id,
        "promoted": True
    }


@router.get("/{company_id}/decisions/{decision_id}")
async def get_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """Get a single decision (knowledge entry)."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    result = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Transform to expected format
    entry = result.data
    # Use body_md if available, fall back to summary for legacy data
    body_md = entry.get("body_md", "")
    content = body_md if body_md else entry.get("summary", "")

    decision = {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": content,  # Full council response from body_md (with summary fallback)
        "user_question": entry.get("user_question", ""),  # User question for context
        "decision_summary": entry.get("decision_summary", ""),  # AI-generated summary
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_id": entry.get("department_id"),
        "department_ids": entry.get("department_ids") or ([entry.get("department_id")] if entry.get("department_id") else []),
        "project_id": entry.get("project_id"),
        "is_promoted": entry.get("is_promoted", False),
        "promoted_to_id": entry.get("promoted_to_id"),
        "promoted_to_type": entry.get("promoted_to_type"),  # sop/framework/policy
        "promoted_by_name": entry.get("promoted_by_name"),  # Who promoted it
        "promoted_at": entry.get("promoted_at"),  # When it was promoted
        "source_conversation_id": entry.get("source_conversation_id"),
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
        "scope": entry.get("scope", "department"),
        "auto_inject": entry.get("auto_inject", False),
        "council_type": entry.get("council_type")
    }

    return {"decision": decision}


@router.post("/{company_id}/decisions/{decision_id}/archive")
async def archive_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """
    Archive (soft delete) a decision.
    Sets is_active=False rather than permanently deleting.
    Uses POST instead of DELETE for better compatibility.
    Uses service client to bypass RLS on knowledge_entries table.
    """
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # Still need user client to resolve company
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Verify decision exists and belongs to company, get project_id for sync
    check = service_client.table("knowledge_entries") \
        .select("id, project_id, department_ids") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    project_id = check.data.get("project_id")

    # Soft delete by setting is_active=False
    result = service_client.table("knowledge_entries") \
        .update({"is_active": False}) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to archive decision")

    # Recalculate project's department_ids from remaining active decisions
    if project_id:
        try:
            # Get all remaining active decisions for this project
            remaining = service_client.table("knowledge_entries") \
                .select("department_ids, department_id") \
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
                # Also check legacy department_id field
                legacy_dept = decision.get("department_id")
                if legacy_dept and legacy_dept not in all_dept_ids:
                    all_dept_ids.add(legacy_dept)

            # Update project's department_ids
            service_client.table("projects") \
                .update({"department_ids": list(all_dept_ids) if all_dept_ids else None}) \
                .eq("id", project_id) \
                .execute()
        except Exception as e:
            # Log but don't fail the archive operation
            print(f"Warning: Failed to sync project departments after archive: {e}")

    return {"success": True, "message": "Decision archived"}


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
    """
    service_client = get_service_client()
    user_client = get_client(user)

    # Resolve company UUID
    try:
        company_uuid = resolve_company_id(user_client, company_id)
    except HTTPException:
        return {"decisions": [], "project": None}

    # Verify project exists and belongs to company
    project_result = service_client.table("projects") \
        .select("id, name, description, status, created_at") \
        .eq("id", project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project_result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all decisions for this project, ordered by created_at (timeline)
    decisions_result = service_client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    # Get departments for name lookup
    dept_result = service_client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()
    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    # Transform decisions to expected format
    decisions = []
    for entry in decisions_result.data or []:
        dept_id = entry.get("department_id")
        dept_ids = entry.get("department_ids") or ([dept_id] if dept_id else [])
        dept_info = dept_map.get(dept_id, {}) if dept_id else {}

        # Build list of department info for all departments
        dept_names = []
        for did in dept_ids:
            d = dept_map.get(did, {})
            if d.get("name"):
                dept_names.append(d.get("name"))

        # Debug: log what's in the database
        body_md = entry.get("body_md", "")
        summary = entry.get("summary", "")
        print(f"[DECISION] id={entry.get('id')[:8]}... body_md={len(body_md) if body_md else 0} chars, summary={len(summary) if summary else 0} chars", flush=True)

        # Use body_md if available, fall back to summary for legacy data
        content = body_md if body_md else summary

        decisions.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "content": content,  # Full council response from body_md (with summary fallback)
            "decision_summary": entry.get("decision_summary"),  # Clean prose summary for display
            "user_question": entry.get("user_question"),  # The original question (may be raw)
            "tags": entry.get("tags", []),
            "category": entry.get("category"),
            "department_id": dept_id,  # Primary for backwards compat
            "department_ids": dept_ids,  # All departments
            "department_name": dept_info.get("name"),  # Primary for backwards compat
            "department_names": dept_names,  # All department names
            "department_slug": dept_info.get("slug"),
            "source_conversation_id": entry.get("source_conversation_id"),
            "response_index": entry.get("response_index"),  # For linking to specific response in multi-turn
            "created_at": entry.get("created_at"),
            "council_type": entry.get("council_type"),
            "is_promoted": entry.get("is_promoted", False),
            "promoted_to_id": entry.get("promoted_to_id")
        })

    return {
        "project": project_result.data,
        "decisions": decisions,
        "total_count": len(decisions)
    }


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
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all active decisions for this project
    decisions_result = service_client.table("knowledge_entries") \
        .select("department_ids, department_id") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .execute()

    print(f"[SYNC] Found {len(decisions_result.data or [])} decisions for project {project_id}", flush=True)

    # Collect unique department_ids from all decisions
    all_dept_ids = set()
    for decision in (decisions_result.data or []):
        dept_ids = decision.get("department_ids") or []
        print(f"[SYNC] Decision has department_ids={dept_ids}, department_id={decision.get('department_id')}", flush=True)
        for did in dept_ids:
            if did:
                all_dept_ids.add(did)
        # Also check legacy department_id field
        legacy_dept = decision.get("department_id")
        if legacy_dept and legacy_dept not in all_dept_ids:
            all_dept_ids.add(legacy_dept)

    print(f"[SYNC] Collected all_dept_ids={all_dept_ids}", flush=True)

    # Update project's department_ids
    updated_dept_ids = list(all_dept_ids) if all_dept_ids else None
    print(f"[SYNC] Updating project {project_id} with department_ids={updated_dept_ids}", flush=True)
    service_client.table("projects") \
        .update({"department_ids": updated_dept_ids}) \
        .eq("id", project_id) \
        .execute()

    return {
        "success": True,
        "project_id": project_id,
        "department_ids": updated_dept_ids,
        "decision_count": len(decisions_result.data or [])
    }


@router.delete("/{company_id}/decisions/{decision_id}")
async def delete_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """
    Permanently delete a decision.
    Uses service client to bypass RLS on knowledge_entries table.
    """
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # Still need user client to resolve company
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Verify decision exists and belongs to company
    check = service_client.table("knowledge_entries") \
        .select("id, title") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    decision_title = check.data.get("title", "Decision")

    # Permanently delete the decision
    result = service_client.table("knowledge_entries") \
        .delete() \
        .eq("id", decision_id) \
        .execute()

    return {"success": True, "message": f"Decision '{decision_title}' deleted"}


@router.post("/{company_id}/decisions/{decision_id}/generate-summary")
async def generate_decision_summary(
    company_id: str,
    decision_id: str,
    user=Depends(get_current_user)
):
    """
    Generate an AI summary for a decision - includes title and contextual summary.
    Uses Sarah (Project Manager persona) with Gemini 2.5 Flash.
    For multi-turn conversations, includes context from prior decisions.

    This endpoint is for on-demand regeneration (e.g., if user wants to refresh).
    New decisions should have summaries generated at save time.
    """
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # Still need user client to resolve company
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Check if we already have a good cached summary
    result = service_client.table("knowledge_entries") \
        .select("id, title, decision_summary") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    existing_summary = result.data.get("decision_summary")

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

    # Generate new summary using the internal function
    return await generate_decision_summary_internal(decision_id, company_uuid, service_client)


# ============================================
# ACTIVITY ENDPOINTS
# ============================================

@router.get("/{company_id}/activity")
async def get_activity_logs(
    company_id: str,
    limit: int = 50,
    event_type: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Get activity logs for a company.
    Optional filter by event_type (decision, playbook, role, department, council_session).

    Returns logs with lightweight playbook/decision IDs for click navigation.
    """
    # Use service client for read operations
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"logs": [], "playbook_ids": [], "decision_ids": []}

    query = client.table("activity_logs") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("created_at", desc=True) \
        .limit(limit)

    if event_type:
        query = query.eq("event_type", event_type)

    result = query.execute()
    logs = result.data or []

    # Extract unique related IDs for navigation (lightweight - just IDs, not full objects)
    playbook_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "playbook" and log.get("related_id")
    ))
    decision_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "decision" and log.get("related_id")
    ))

    return {"logs": logs, "playbook_ids": playbook_ids, "decision_ids": decision_ids}


async def log_activity(
    company_id: str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    department_id: Optional[str] = None,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None
):
    """
    Helper function to log an activity event.
    Call this from other endpoints when something notable happens.

    Args:
        company_id: Company UUID
        event_type: Type of event (decision, playbook, role, department, council_session)
        title: Short title for the activity
        description: Optional longer description
        department_id: Optional department UUID
        related_id: Optional UUID of related entity
        related_type: Optional type of related entity
        conversation_id: Optional UUID of source conversation (for tracing back to council discussion)
        message_id: Optional UUID of specific message in conversation
    """
    client = get_service_client()

    try:
        client.table("activity_logs").insert({
            "company_id": company_id,
            "event_type": event_type,
            "title": title,
            "description": description,
            "department_id": department_id,
            "related_id": related_id,
            "related_type": related_type,
            "conversation_id": conversation_id,
            "message_id": message_id
        }).execute()
    except Exception as e:
        # Don't fail the main operation if logging fails
        print(f"Warning: Failed to log activity: {e}")
