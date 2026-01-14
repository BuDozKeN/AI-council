"""
Company Decisions Router

Endpoints for managing saved council decisions:
- List/get/create/archive/delete decisions
- Promote decisions to playbooks
- Link/create projects from decisions
- Generate AI summaries
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import re

from ...auth import get_current_user
from ...security import escape_sql_like_pattern, log_app_event
from .utils import (
    get_client,
    get_service_client,
    verify_company_access,
    resolve_company_id,
    log_activity,
    auto_regenerate_project_context,
    generate_decision_summary_internal,
    ValidCompanyId,
    ValidDecisionId,
    DecisionCreate,
    PromoteDecision,
)

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/company", tags=["company-decisions"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class LinkDecisionToProject(BaseModel):
    project_id: str


class CreateProjectFromDecision(BaseModel):
    name: str
    department_ids: Optional[List[str]] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _sync_project_departments_internal(project_id: str):
    """Internal helper to sync project department_ids from its decisions."""
    service_client = get_service_client()

    decisions_result = service_client.table("knowledge_entries") \
        .select("department_ids") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .execute()

    all_dept_ids = set()
    for decision in (decisions_result.data or []):
        dept_ids = decision.get("department_ids") or []
        for did in dept_ids:
            if did:
                all_dept_ids.add(did)

    updated_dept_ids = list(all_dept_ids) if all_dept_ids else None
    service_client.table("projects") \
        .update({"department_ids": updated_dept_ids}) \
        .eq("id", project_id) \
        .execute()

    return updated_dept_ids


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/decisions")
@limiter.limit("100/minute;500/hour")
async def get_decisions(request: Request, company_id: str,
    search: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    """Get all decisions (knowledge entries), newest first."""
    client = get_client(user)
    service_client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"decisions": [], "departments": []}

    verify_company_access(service_client, company_uuid, user)

    dept_result = service_client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()

    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    query = service_client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("is_active", True)

    if search:
        escaped_search = escape_sql_like_pattern(search)
        query = query.or_(f"title.ilike.%{escaped_search}%,content.ilike.%{escaped_search}%")

    result = query.order("created_at", desc=True).limit(limit).execute()

    decisions = []
    for entry in result.data or []:
        dept_ids = entry.get("department_ids") or []
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
        })

    departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]

    return {"decisions": decisions, "departments": departments}


@router.post("/{company_id}/decisions")
@limiter.limit("30/minute;100/hour")
async def create_decision(request: Request, company_id: ValidCompanyId, data: DecisionCreate, user=Depends(get_current_user)):
    """Save a new decision from a council session."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    user_id = user.get('id') if isinstance(user, dict) else user.id

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

    if data.project_id:
        insert_data["project_id"] = data.project_id

    if data.council_type:
        insert_data["council_type"] = data.council_type

    if data.response_index is not None:
        insert_data["response_index"] = data.response_index

    result = client.table("knowledge_entries").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save decision")

    entry = result.data[0]
    decision_id = entry.get("id")

    ai_title = data.title
    try:
        summary_result = await generate_decision_summary_internal(
            decision_id=decision_id,
            company_uuid=company_uuid,
            service_client=get_service_client()
        )
        if summary_result.get("title"):
            ai_title = summary_result["title"]
    except Exception:
        pass

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

    context_updated = False
    if data.project_id:
        try:
            context_updated = await auto_regenerate_project_context(data.project_id, user)
        except Exception:
            pass

    return {"decision": decision, "context_updated": context_updated}


@router.get("/{company_id}/decisions/{decision_id}")
@limiter.limit("100/minute;500/hour")
async def get_decision(request: Request, company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """Get a single decision (knowledge entry)."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    try:
        result = client.table("knowledge_entries") \
            .select("*") \
            .eq("id", decision_id) \
            .eq("company_id", company_uuid) \
            .eq("is_active", True) \
            .execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Resource not found")

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Resource not found")

    entry = result.data[0]

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
@limiter.limit("30/minute;100/hour")
async def archive_decision(request: Request, company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """Archive (soft delete) a decision."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

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

    result = client.table("knowledge_entries") \
        .update({"is_active": False}) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to archive decision")

    if project_id:
        try:
            remaining = client.table("knowledge_entries") \
                .select("department_ids") \
                .eq("project_id", project_id) \
                .eq("is_active", True) \
                .execute()

            all_dept_ids = set()
            for decision in (remaining.data or []):
                dept_ids = decision.get("department_ids") or []
                for did in dept_ids:
                    if did:
                        all_dept_ids.add(did)

            client.table("projects") \
                .update({"department_ids": list(all_dept_ids) if all_dept_ids else None}) \
                .eq("id", project_id) \
                .execute()
        except Exception as e:
            log_app_event("ARCHIVE_SYNC_WARNING", details={"project_id": project_id, "error": str(e)})

    return {"success": True, "message": "Decision archived"}


@router.delete("/{company_id}/decisions/{decision_id}")
@limiter.limit("20/minute;50/hour")
async def delete_decision(request: Request, company_id: ValidCompanyId, decision_id: ValidDecisionId, user=Depends(get_current_user)):
    """Permanently delete a decision."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    check = client.table("knowledge_entries") \
        .select("id, title") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    decision_title = check.data.get("title", "Decision")

    client.table("knowledge_entries") \
        .delete() \
        .eq("id", decision_id) \
        .execute()

    await log_activity(
        company_id=company_uuid,
        event_type="decision",
        title=f"Deleted: {decision_title}",
        description="Decision was permanently deleted",
        related_id=decision_id,
        related_type="decision"
    )

    current_user_id = user.get('id') if isinstance(user, dict) else user.id
    log_app_event("DECISION_DELETED", "Decision permanently deleted",
                  user_id=current_user_id, resource_id=decision_id)

    return {"success": True, "message": f"Decision '{decision_title}' deleted"}


@router.post("/{company_id}/decisions/{decision_id}/promote")
@limiter.limit("20/minute;50/hour")
async def promote_decision(request: Request, company_id: ValidCompanyId, decision_id: ValidDecisionId, data: PromoteDecision, user=Depends(get_current_user)):
    """Promote a decision to a playbook (SOP/framework/policy)."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    base_slug = data.slug
    if not base_slug:
        base_slug = re.sub(r'[^a-z0-9]+', '-', data.title.lower()).strip('-')

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
            break

        suffix += 1
        slug = f"{base_slug}-{suffix}"

    content = decision.data.get("content", "")
    decision_dept_ids = decision.data.get("department_ids") or []
    first_dept_id = decision_dept_ids[0] if decision_dept_ids else None

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

    client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": content,
        "status": "active",
        "is_current": True,
        "change_summary": f"Promoted from decision: {decision.data['title']}",
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    client.table("knowledge_entries").update({
        "promoted_to_id": doc_id,
        "promoted_to_type": data.doc_type
    }).eq("id", decision_id).execute()

    playbook = doc_result.data[0]
    playbook["content"] = content
    playbook["version"] = 1

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


@router.post("/{company_id}/decisions/{decision_id}/link-project")
@limiter.limit("30/minute;100/hour")
async def link_decision_to_project(request: Request, company_id: str, decision_id: str, data: LinkDecisionToProject, user=Depends(get_current_user)):
    """Link a decision to an existing project."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    project = client.table("projects") \
        .select("id, name, department_ids") \
        .eq("id", data.project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    result = client.table("knowledge_entries") \
        .update({
            "project_id": data.project_id,
            "promoted_to_type": "project"
        }) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to link decision to project")

    _sync_project_departments_internal(data.project_id)

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


@router.post("/{company_id}/decisions/{decision_id}/create-project")
@limiter.limit("20/minute;50/hour")
async def create_project_from_decision(request: Request, company_id: str, decision_id: str, data: CreateProjectFromDecision, user=Depends(get_current_user)):
    """Create a new project from a decision."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    decision = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    dept_ids = data.department_ids
    if not dept_ids:
        dept_ids = decision.data.get("department_ids") or []

    if isinstance(user, dict):
        user_id = user.get('id') or user.get('sub')
    else:
        user_id = getattr(user, 'id', None) or getattr(user, 'sub', None)

    if not user_id:
        raise HTTPException(status_code=401, detail="Could not determine user ID from authentication")

    decision_content = decision.data.get("content") or ""
    user_question = decision.data.get("question") or decision.data.get("title") or ""
    project_name = data.name

    context_md = ""
    description = f"Created from decision: {decision.data.get('title', 'Council Decision')}"

    try:
        from ...personas import get_db_persona_with_fallback
        from ...openrouter import query_model, MOCK_LLM
        from .utils import save_internal_llm_usage
        import json as json_module

        if not MOCK_LLM and decision_content:
            persona = await get_db_persona_with_fallback('sarah')
            system_prompt = persona.get('system_prompt', '')
            models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

            if isinstance(models, str):
                models = json_module.loads(models)

            free_text = f"Project: {project_name}\n\n"
            if user_question:
                free_text += f"Original question: {user_question}\n\n"
            free_text += f"Council decision/insights:\n{decision_content[:4000]}"

            prompt = f"""Create a project brief from this council decision:

"{free_text}"

Return JSON with these exact fields:

{{
  "description": "One sentence describing what this project delivers",
  "context_md": "Well-formatted markdown brief with sections"
}}

Use sections: ## Objective, ## Key Insights, ## Deliverables, ## Success Criteria"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]

            for model in models[:2]:
                try:
                    result = await query_model(model=model, messages=messages)

                    if result and result.get('content'):
                        # Track usage
                        if company_uuid and result.get('usage'):
                            try:
                                await save_internal_llm_usage(
                                    company_id=company_uuid,
                                    operation_type='project_from_decision',
                                    model=model,
                                    usage=result['usage'],
                                    related_id=decision_id
                                )
                            except Exception:
                                pass  # Don't fail if tracking fails

                        content = result['content']
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
        if decision_content:
            context_md = f"## Overview\n\n{decision_content[:2000]}"

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

    client.table("knowledge_entries") \
        .update({
            "project_id": project_id,
            "promoted_to_type": "project"
        }) \
        .eq("id", decision_id) \
        .execute()

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
@limiter.limit("100/minute;500/hour")
async def get_project_decisions(request: Request, company_id: str,
    project_id: str,
    limit: int = 100,
    user=Depends(get_current_user)
):
    """Get all decisions linked to a specific project."""
    client = get_client(user)

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"decisions": [], "project": None}

    project_result = client.table("projects") \
        .select("id, name, description, status, created_at") \
        .eq("id", project_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not project_result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    decisions_result = client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    dept_result = client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()
    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    decisions = []
    for entry in decisions_result.data or []:
        dept_ids = entry.get("department_ids") or []
        first_dept_id = dept_ids[0] if dept_ids else None
        dept_info = dept_map.get(first_dept_id, {}) if first_dept_id else {}

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


@router.post("/{company_id}/projects/{project_id}/sync-departments")
@limiter.limit("30/minute;100/hour")
async def sync_project_departments(request: Request, company_id: str, project_id: str, user=Depends(get_current_user)):
    """Recalculate project's department_ids from all its active decisions."""
    service_client = get_service_client()
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

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


@router.post("/{company_id}/decisions/{decision_id}/generate-summary")
@limiter.limit("10/minute;30/hour")
async def generate_decision_summary(request: Request, company_id: str,
    decision_id: str,
    user=Depends(get_current_user)
):
    """Generate an AI summary for a decision."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    result = client.table("knowledge_entries") \
        .select("id, title, content_summary") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    existing_summary = result.data.get("content_summary")

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

    service_client = get_service_client()
    return await generate_decision_summary_internal(decision_id, company_uuid, service_client)
