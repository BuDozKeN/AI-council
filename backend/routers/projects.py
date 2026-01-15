"""
Projects Router

Endpoints for managing projects:
- CRUD operations on projects
- AI-assisted context extraction and structuring
- Project context regeneration
- Decision merging into projects
- Project reports
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import re
import json

from ..auth import get_current_user
from .. import storage
from ..security import SecureHTTPException
from ..i18n import t, get_locale_from_request

# Import shared rate limiter (ensures limits are tracked globally)
from ..rate_limit import limiter


router = APIRouter(prefix="", tags=["projects"])


# =============================================================================
# SECURITY HELPERS
# =============================================================================

# UUID validation pattern
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def validate_uuid(value: str, field_name: str = "id", locale: str = 'en') -> str:
    """Validate that a value is a valid UUID format."""
    if not value or not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=t('errors.invalid_uuid', locale, field=field_name)
        )
    return value


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ProjectCreate(BaseModel):
    """Request to create a new project."""
    name: str
    description: Optional[str] = None
    context_md: Optional[str] = None
    department_id: Optional[str] = None
    department_ids: Optional[List[str]] = None
    source_conversation_id: Optional[str] = None
    source: str = "manual"


class ProjectUpdate(BaseModel):
    """Request to update a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    context_md: Optional[str] = None
    status: Optional[str] = None
    department_id: Optional[str] = None
    department_ids: Optional[List[str]] = None
    source_conversation_id: Optional[str] = None


class ExtractProjectRequest(BaseModel):
    """Request to extract project details from council response."""
    user_question: str = Field(..., max_length=50000)
    council_response: str = Field(..., max_length=50000)
    company_id: Optional[str] = Field(None, max_length=100)  # For usage tracking


class StructureContextRequest(BaseModel):
    """Request to structure free-form project description."""
    free_text: str = Field(..., max_length=50000)
    project_name: str = Field("", max_length=200)
    company_id: Optional[str] = Field(None, max_length=100)  # For usage tracking


class MergeDecisionRequest(BaseModel):
    """Request to merge a decision into project context. Updated limits."""
    existing_context: str = Field(..., max_length=100000)
    decision_content: str = Field(..., max_length=50000)
    user_question: str = Field("", max_length=50000)
    save_decision: bool = False
    company_id: Optional[str] = Field(None, max_length=100)
    conversation_id: Optional[str] = Field(None, max_length=100)
    response_index: Optional[int] = None
    decision_title: Optional[str] = Field(None, max_length=500)
    department_id: Optional[str] = Field(None, max_length=100)
    department_ids: Optional[List[str]] = None
    council_type: Optional[str] = Field(None, max_length=100)


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.get("/companies/{company_id}/projects")
@limiter.limit("100/minute;500/hour")
async def list_projects(request: Request, company_id: str, user: dict = Depends(get_current_user)):
    """List all active projects for a company."""
    access_token = user.get("access_token")
    try:
        projects = storage.get_projects(company_id, access_token)
        return {"projects": projects}
    except Exception:
        return {"projects": []}


@router.post("/companies/{company_id}/projects")
@limiter.limit("30/minute;100/hour")
async def create_project(request: Request, company_id: str,
    project: ProjectCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new project."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    user_id = user.get("id")

    try:
        result = storage.create_project(
            company_id_or_slug=company_id,
            user_id=user_id,
            name=project.name,
            description=project.description,
            context_md=project.context_md,
            department_id=project.department_id,
            department_ids=project.department_ids,
            source_conversation_id=project.source_conversation_id,
            source=project.source,
            access_token=access_token
        )

        if not result:
            raise HTTPException(status_code=500, detail=t('errors.project_create_failed', locale))

        return {"project": result}
    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(
            f"Failed to create project: {str(e)}",
            user_id=user_id
        )


@router.get("/projects/{project_id}")
@limiter.limit("100/minute;500/hour")
async def get_project(request: Request, project_id: str, user: dict = Depends(get_current_user)):
    """Get a single project."""
    locale = get_locale_from_request(request)
    validate_uuid(project_id, "project_id", locale)
    access_token = user.get("access_token")
    project = storage.get_project(project_id, access_token)

    if not project:
        raise HTTPException(status_code=404, detail=t('errors.project_not_found', locale))

    return {"project": project}


@router.patch("/projects/{project_id}")
@limiter.limit("30/minute;100/hour")
async def update_project(request: Request, project_id: str,
    update: ProjectUpdate,
    user: dict = Depends(get_current_user)
):
    """Update a project's name, description, context, or status."""
    locale = get_locale_from_request(request)
    validate_uuid(project_id, "project_id", locale)
    access_token = user.get("access_token")

    try:
        result = storage.update_project(
            project_id=project_id,
            access_token=access_token,
            name=update.name,
            description=update.description,
            context_md=update.context_md,
            status=update.status,
            department_id=update.department_id,
            department_ids=update.department_ids,
            source_conversation_id=update.source_conversation_id
        )

        if not result:
            raise HTTPException(status_code=404, detail=t('errors.project_not_found', locale))

        return {"project": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        err_msg = str(e).encode('ascii', 'replace').decode('ascii')
        raise SecureHTTPException.internal_error(f"Failed to update project: {err_msg}")


@router.post("/projects/{project_id}/touch")
@limiter.limit("100/minute;500/hour")
async def touch_project(request: Request, project_id: str, user: dict = Depends(get_current_user)):
    """Update a project's last_accessed_at timestamp."""
    access_token = user.get("access_token")
    success = storage.touch_project_last_accessed(project_id, access_token)
    return {"success": success}


@router.delete("/projects/{project_id}")
@limiter.limit("20/minute;50/hour")
async def delete_project(request: Request, project_id: str, user: dict = Depends(get_current_user)):
    """Delete a project permanently."""
    locale = get_locale_from_request(request)
    validate_uuid(project_id, "project_id", locale)
    access_token = user.get("access_token")

    try:
        from ..routers import company as company_router

        deleted_project = storage.delete_project(project_id, access_token)
        if not deleted_project:
            raise HTTPException(status_code=404, detail=t('errors.project_delete_failed', locale))

        if deleted_project.get("company_id"):
            await company_router.log_activity(
                company_id=deleted_project["company_id"],
                event_type="project",
                title=f"Deleted: {deleted_project.get('name', 'Project')}",
                description="Project was permanently deleted",
                related_id=project_id,
                related_type="project"
            )

        return {"success": True}
    except Exception as e:
        raise SecureHTTPException.internal_error(f"Failed to delete project: {str(e)}")


@router.get("/companies/{company_id}/projects/stats")
@limiter.limit("100/minute;500/hour")
async def list_projects_with_stats(request: Request, company_id: str,
    status: Optional[str] = None,
    include_archived: bool = False,
    user: dict = Depends(get_current_user)
):
    """List projects with stats for the Projects Tab in Command Centre."""
    access_token = user.get("access_token")
    try:
        projects = storage.get_projects_with_stats(
            company_id,
            access_token,
            status_filter=status,
            include_archived=include_archived
        )
        return {"projects": projects}
    except Exception:
        return {"projects": []}


# =============================================================================
# AI-ASSISTED PROJECT CREATION
# =============================================================================

@router.post("/projects/extract")
@limiter.limit("10/minute;50/hour")
async def extract_project_from_response(
    request: Request,
    extract_request: ExtractProjectRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to extract a clear project name and description from a council response.
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..knowledge_fallback import extract_project_fallback
    from ..personas import get_db_persona_with_fallback

    if MOCK_LLM:
        return {
            "success": True,
            "extracted": {
                "name": "Context Memory System",
                "description": "A system to help AI assistants remember important decisions.",
                "used_ai": True
            }
        }

    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    user_question = extract_request.user_question[:3000] if extract_request.user_question else ""
    council_response = extract_request.council_response[:5000] if extract_request.council_response else ""

    extraction_prompt = f"""## TASK: Extract project name and description from a council discussion

Your goal: Create a project name and description that ANYONE can understand at a glance.

THE USER'S ORIGINAL QUESTION:
{user_question}

THE COUNCIL'S ADVICE (for context only):
{council_response}

---

PROJECT NAME RULES (CRITICAL):
- 2-5 words maximum
- Must describe the SUBJECT/TOPIC, not the question format
- Must make sense standing alone without any context

EXAMPLES OF WHAT THE USER ASKED → WHAT THE PROJECT NAME SHOULD BE:
- "How do we keep users engaged while waiting?" → "User Wait Experience"
- "What's the best way to handle authentication?" → "Authentication System"

DESCRIPTION RULES:
- First sentence: One clear statement of what this project addresses
- Then 2-3 bullet points with key considerations
- Keep it scannable

CONTEXT_MD RULES (IMPORTANT):
- Create structured markdown that provides useful context for future discussions
- Include: Background, Key Decisions Made, Guidelines to Follow
- Format with headers (##) and bullet points

Respond ONLY with this JSON (no markdown code blocks):
{{
  "name": "Clear Topic Name",
  "description": "Brief description for project list.",
  "context_md": "## Background\\nOne paragraph explaining the project."
}}"""

    model_prefs = persona.get('model_preferences', ['anthropic/claude-3-5-haiku-20241022'])
    if isinstance(model_prefs, str):
        model_prefs = json.loads(model_prefs)

    model_used = model_prefs[0]

    try:
        messages = [
            {"role": "system", "content": system_prompt + "\n\nRespond ONLY with valid JSON."},
            {"role": "user", "content": extraction_prompt}
        ]

        result = await query_model(model=model_used, messages=messages)

        # Track internal LLM usage if company_id provided
        if extract_request.company_id and result and result.get('usage'):
            try:
                from .company.utils import save_internal_llm_usage
                await save_internal_llm_usage(
                    company_id=extract_request.company_id,
                    operation_type='project_extraction',
                    model=model_used,
                    usage=result['usage']
                )
            except Exception:
                pass  # Don't fail extraction if tracking fails

        if result and result.get('content'):
            content = result['content'].strip()
            if content.startswith('```'):
                content = content.split('\n', 1)[1]
                if content.endswith('```'):
                    content = content[:-3]
                elif '```' in content:
                    content = content.split('```')[0]
            content = content.strip()

            try:
                extracted = json.loads(content)
                extracted["used_ai"] = True
                return {"success": True, "extracted": extracted}
            except json.JSONDecodeError:
                fallback = extract_project_fallback(extract_request.user_question, extract_request.council_response)
                return {"success": True, "extracted": fallback}
        else:
            fallback = extract_project_fallback(extract_request.user_question, extract_request.council_response)
            return {"success": True, "extracted": fallback}

    except Exception:
        fallback = extract_project_fallback(extract_request.user_question, extract_request.council_response)
        return {"success": True, "extracted": fallback}


@router.post("/projects/structure-context")
@limiter.limit("10/minute;50/hour")
async def structure_project_context(
    request: Request,
    structure_request: StructureContextRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to structure a free-form project description into organized context.

    Performance optimizations:
    - Redis caching: Identical requests return cached results instantly
    - Parallel model queries: All models queried simultaneously, first success wins
    """
    import asyncio
    from ..openrouter import query_model, MOCK_LLM
    from ..openrouter import get_cached_llm_response, cache_llm_response
    from ..personas import get_db_persona_with_fallback

    if MOCK_LLM:
        from ..knowledge_fallback import _short_title
        mock_title = structure_request.project_name or _short_title(structure_request.free_text, max_words=4)
        return {
            "structured": {
                "context_md": f"Objective\n{structure_request.free_text[:300]}\n\nGoals\n- Define clear metrics",
                "description": structure_request.free_text[:150],
                "suggested_name": mock_title
            }
        }

    project_name = structure_request.project_name.strip() if structure_request.project_name else ""
    free_text = structure_request.free_text[:5000] if structure_request.free_text else ""

    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    if isinstance(models, str):
        models = json.loads(models)

    prompt = f"""Create a project brief from this description:

"{free_text}"

Return JSON with these exact fields:

{{
  "suggested_name": "Clear Project Title (3-5 words)",
  "description": "One sentence describing what this project delivers",
  "context_md": "Well-formatted markdown brief with sections below"
}}

For context_md, use these sections (skip any that don't apply):
## Objective
## Deliverables
## Success Criteria
## Scope
## Technical Notes"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]

    # Check Redis cache first - identical requests return instantly
    if structure_request.company_id:
        primary_model = models[0] if models else 'openai/gpt-4o'
        cached = await get_cached_llm_response(
            company_id=structure_request.company_id,
            model=primary_model,
            messages=messages
        )
        if cached and cached.get('content'):
            structured = _parse_structured_response(cached['content'], free_text)
            if structured:
                return {"structured": structured}

    # Query all models in parallel - first valid response wins
    MODEL_TIMEOUT = 8.0  # Uniform timeout for parallel queries

    async def query_with_model(model: str):
        """Query a single model and return (model, result) tuple."""
        try:
            result = await query_model(model=model, messages=messages, timeout=MODEL_TIMEOUT)
            if result and result.get('content'):
                return (model, result)
        except Exception:
            pass
        return (model, None)

    # Run all model queries in parallel
    results = await asyncio.gather(
        *[query_with_model(model) for model in models],
        return_exceptions=True
    )

    # Find first successful result
    successful_model = None
    successful_result = None
    for item in results:
        if isinstance(item, Exception):
            continue
        model, result = item
        if result and result.get('content'):
            structured = _parse_structured_response(result['content'], free_text)
            if structured:
                successful_model = model
                successful_result = result

                # Track internal LLM usage
                if structure_request.company_id and result.get('usage'):
                    try:
                        from .company.utils import save_internal_llm_usage
                        await save_internal_llm_usage(
                            company_id=structure_request.company_id,
                            operation_type='context_structuring',
                            model=model,
                            usage=result['usage']
                        )
                    except Exception:
                        pass

                # Cache the successful response
                if structure_request.company_id:
                    await cache_llm_response(
                        company_id=structure_request.company_id,
                        model=model,
                        messages=messages,
                        response=result
                    )

                return {"structured": structured}

    # All models failed - return fallback
    from ..knowledge_fallback import _short_title
    fallback_title = project_name or _short_title(free_text, max_words=4)
    return {
        "structured": {
            "context_md": f"## Overview\n\n{free_text[:300]}",
            "description": free_text[:150],
            "suggested_name": fallback_title
        }
    }


def _parse_structured_response(content: str, free_text: str) -> dict | None:
    """Parse LLM response into structured project data."""
    try:
        # Strip markdown code blocks
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        if '```' in content:
            content = content.split('```')[0]
        content = content.strip()

        structured = json.loads(content)

        # Ensure we have a valid project name
        if not structured.get('suggested_name') or structured.get('suggested_name') == 'New Project':
            from ..knowledge_fallback import _short_title
            structured['suggested_name'] = _short_title(free_text, max_words=4)

        return structured
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


# =============================================================================
# DECISION MERGING
# =============================================================================

@router.post("/projects/{project_id}/merge-decision")
@limiter.limit("5/minute;30/hour")
async def merge_decision_into_project(
    request: Request,
    project_id: str,
    merge_request: MergeDecisionRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to intelligently merge a council decision into existing project context.

    REFACTORED: Complexity reduced from F (46) to C (~12) by extracting helper functions.
    """
    validate_uuid(project_id, "project_id")
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_db_persona_with_fallback
    from ..database import get_supabase_with_auth
    from .projects_refactored import (
        _extract_json_from_llm_response,
        _generate_decision_title,
        _normalize_department_ids,
        _save_decision_to_knowledge,
        _sync_departments_to_project,
        _track_merge_llm_usage,
        _trigger_summary_generation
    )

    # 1. Handle mock mode
    if MOCK_LLM:
        return {
            "merged": {
                "context_md": merge_request.existing_context + "\n\n## Recent Decision\nKey learning from council discussion.",
                "summary": "Added insights from recent council decision",
                "changes": "- Added new section on Recent Decision"
            }
        }

    # 2. Get persona and build prompts
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    existing = merge_request.existing_context[:10000] if merge_request.existing_context else ""
    decision = merge_request.decision_content[:8000] if merge_request.decision_content else ""
    question = merge_request.user_question[:2000] if merge_request.user_question else ""
    today_date = datetime.now().strftime("%B %d, %Y")

    user_prompt = f"""## TASK: Merge a council decision into project documentation

## CURRENT PROJECT DOCUMENTATION:
{existing if existing else "(This is a new project with no existing documentation)"}

---

## THE QUESTION THAT WAS ASKED:
{question if question else "(No specific question recorded)"}

## NEW COUNCIL DECISION TO INCORPORATE:
{decision}

---

## YOUR INSTRUCTIONS:

1. **READ** the existing documentation carefully
2. **EXTRACT** only the KEY POINTS from the council decision
3. **MERGE** these into the existing document:
   - Keep all existing sections that are still relevant
   - Add a "## Decision Log" section if one doesn't exist
   - Add this decision with today's date: {today_date}
   - NEVER lose existing important information
   - ALWAYS deduplicate

## OUTPUT FORMAT:

Return valid JSON with exactly these fields:
{{
  "context_md": "The complete updated project documentation in markdown format",
  "summary": "A single sentence describing what was decided",
  "changes": "Bullet list of what you added or changed"
}}"""

    # 3. Prepare models and messages
    model_prefs = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(model_prefs, str):
        model_prefs = json.loads(model_prefs)

    MERGE_MODELS = [(model_prefs[0], 45.0)] + [(m, 30.0) for m in model_prefs[1:3]]
    messages = [
        {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
        {"role": "user", "content": user_prompt}
    ]

    # 4. Try models until one succeeds
    merged = None
    for model, timeout in MERGE_MODELS:
        try:
            result = await query_model(model=model, messages=messages, timeout=timeout)

            # Track LLM usage
            await _track_merge_llm_usage(merge_request.company_id, project_id, model, result.get('usage') if result else None)

            # Extract and parse JSON from response
            if result and result.get('content'):
                merged = _extract_json_from_llm_response(result['content'])
                if merged:
                    break
        except Exception:
            continue

    # 5. Handle merge failure
    if merged is None:
        merged = {
            "context_md": existing,
            "summary": "⚠️ AI merge failed - please try again",
            "changes": f"- Merge failed after trying {len(MERGE_MODELS)} models. Original context preserved.",
            "error": True
        }

    # 6. Save decision if requested
    saved_decision_id, decision_save_error = await _handle_decision_save(
        merge_request, user, project_id, question, get_supabase_with_auth
    )

    # 7. Build response
    response = {"merged": merged}
    if saved_decision_id:
        response["saved_decision_id"] = saved_decision_id
    if decision_save_error:
        response["decision_save_error"] = decision_save_error

    return response


async def _handle_decision_save(
    merge_request: MergeDecisionRequest,
    user: dict,
    project_id: str,
    question: Optional[str],
    get_supabase_with_auth
) -> tuple[Optional[str], Optional[str]]:
    """
    Handle saving decision to knowledge entries.

    Returns:
        Tuple of (saved_decision_id, error_message)
    """
    if not merge_request.save_decision or not merge_request.company_id:
        return None, None

    from .projects_refactored import (
        _generate_decision_title,
        _normalize_department_ids,
        _save_decision_to_knowledge,
        _sync_departments_to_project,
        _trigger_summary_generation
    )

    try:
        access_token = user.get("access_token")
        user_id = user.get('id')

        if not access_token:
            return None, "Authentication required to save decision"

        client = get_supabase_with_auth(access_token)

        # Resolve company UUID
        from ..routers.company import resolve_company_id
        try:
            company_uuid = resolve_company_id(client, merge_request.company_id)
        except Exception:
            company_uuid = merge_request.company_id

        # Generate decision title
        decision_title = merge_request.decision_title or _generate_decision_title(question)

        # Normalize department IDs
        dept_ids = _normalize_department_ids(merge_request.department_ids, merge_request.department_id)

        # Save to knowledge entries
        try:
            saved_decision_id = await _save_decision_to_knowledge(
                client, company_uuid, project_id, decision_title,
                merge_request.decision_content, question, dept_ids,
                merge_request.conversation_id, merge_request.response_index, user_id
            )

            if saved_decision_id:
                # Trigger background summary generation
                _trigger_summary_generation(saved_decision_id, company_uuid)

                # Sync departments to project
                _sync_departments_to_project(client, project_id, dept_ids)

            return saved_decision_id, None

        except Exception as insert_err:
            return None, f"Database error: {str(insert_err)}"

    except Exception as save_err:
        return None, f"Save failed: {str(save_err)}"


@router.post("/projects/{project_id}/regenerate-context")
@limiter.limit("3/minute;15/hour")
async def regenerate_project_context(
    request: Request,
    project_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Regenerate project context by synthesizing ALL decisions associated with this project.
    """
    locale = get_locale_from_request(request)
    validate_uuid(project_id, "project_id", locale)
    from ..openrouter import query_model, MOCK_LLM
    from ..database import get_supabase_service
    from ..personas import get_db_persona_with_fallback

    access_token = user.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail=t('errors.authentication_required', locale))

    service_client = get_supabase_service()

    project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
    if not project_result.data:
        raise HTTPException(status_code=404, detail=t('errors.project_not_found', locale))

    project = project_result.data

    decisions_result = service_client.table("knowledge_entries") \
        .select("id, title, content, question, content_summary, created_at, department_ids") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=False) \
        .execute()

    decisions = decisions_result.data or []
    existing_context = project.get("context_md", "")

    if not decisions and not existing_context:
        return {
            "success": True,
            "context_md": "",
            "message": "No decisions or context to enhance",
            "decision_count": 0
        }

    if MOCK_LLM:
        if decisions:
            mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nRegenerated from {len(decisions)} decisions."
        else:
            mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Enhanced Context\n\n{existing_context}"
        return {
            "success": True,
            "context_md": mock_context,
            "message": f"[MOCK] {'Regenerated from ' + str(len(decisions)) + ' decisions' if decisions else 'Enhanced existing context'}",
            "decision_count": len(decisions)
        }

    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(models, str):
        models = json.loads(models)

    decisions_summary = ""
    for i, d in enumerate(decisions, 1):
        date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
        title = d.get("title", "Untitled")
        question = d.get("question", "")
        content_raw = d.get("content", "")
        content = content_raw[:2000] + "..." if len(content_raw) > 2000 else content_raw

        decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n"
        if question:
            decisions_summary += f"**Question asked:** {question}\n\n"
        decisions_summary += f"{content}\n"

    today_date = datetime.now().strftime("%B %d, %Y")

    if decisions:
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
  "context_md": "The complete project documentation in markdown",
  "sections_count": <number of main sections>,
  "decisions_incorporated": <number of decisions you incorporated>
}}

Today's date: {today_date}"""
    else:
        user_prompt = f"""ENHANCE and STRUCTURE this existing project documentation.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## EXISTING PROJECT CONTEXT (user-provided)
{existing_context}

---

Create a CLEAN, WELL-ORGANIZED project document that:
1. Starts with a clear project overview
2. Organizes the information into logical sections
3. Improves clarity and readability
4. Preserves ALL the original information

Return valid JSON:
{{
  "context_md": "The enhanced project documentation in markdown",
  "sections_count": <number of main sections>,
  "decisions_incorporated": 0
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
                    from .company.utils import save_internal_llm_usage
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type='context_regeneration',
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
                except json.JSONDecodeError as e:
                    last_error = f"JSON parse error: {e}"
                    continue
            else:
                continue

        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
            continue

    if result_data is None:
        raise HTTPException(
            status_code=500,
            detail=t('errors.ai_regenerate_failed', locale, error=last_error)
        )

    new_context = result_data.get("context_md", "")

    service_client.table("projects").update({
        "context_md": new_context,
        "updated_at": datetime.now().isoformat()
    }).eq("id", project_id).execute()

    return {
        "success": True,
        "context_md": new_context,
        "message": f"Regenerated context from {len(decisions)} decisions",
        "decision_count": len(decisions),
        "sections_count": result_data.get("sections_count"),
        "decisions_incorporated": result_data.get("decisions_incorporated")
    }


@router.get("/projects/{project_id}/report")
@limiter.limit("10/minute;30/hour")
async def get_project_report(request: Request, project_id: str,
    user: dict = Depends(get_current_user)
):
    """Generate a professional report of all decisions made for a project."""
    locale = get_locale_from_request(request)
    validate_uuid(project_id, "project_id", locale)
    from .. import knowledge

    try:
        access_token = user.get("access_token")

        project = storage.get_project(project_id, access_token)
        if not project:
            raise HTTPException(status_code=404, detail=t('errors.project_not_found', locale))

        project_name = project.get('name', 'Untitled Project')
        company_id = project.get('company_id')

        if not company_id:
            raise HTTPException(status_code=400, detail=t('errors.project_no_company', locale))

        report = knowledge.generate_project_report(
            project_id=project_id,
            project_name=project_name,
            company_id=company_id
        )

        return report
    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))
