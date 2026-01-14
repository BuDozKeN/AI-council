"""
Company Playbooks Router

Endpoints for SOP, framework, and policy management:
- List playbooks with filters
- Get playbook tags
- Get/Create/Update/Delete playbooks
- AI-assisted playbook structuring
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
import uuid
import json

from ...auth import get_current_user
from .utils import (
    get_client,
    get_service_client,
    resolve_company_id,
    log_activity,
    save_internal_llm_usage,
    ValidCompanyId,
    ValidPlaybookId,
    PlaybookCreate,
    PlaybookUpdate,
)

# Import shared rate limiter (ensures limits are tracked globally)
from ...rate_limit import limiter


# =============================================================================
# PYDANTIC MODELS FOR AI STRUCTURING
# =============================================================================

class StructurePlaybookRequest(BaseModel):
    """Request to structure a playbook from natural language description."""
    description: str = Field(..., max_length=10000)
    company_id: Optional[str] = Field(None, max_length=100)  # For usage tracking
    doc_type: Optional[str] = Field(None, description="Optional: sop, framework, or policy. If not provided, AI will determine.")


# Mapping from doc_type to persona key
DOC_TYPE_TO_PERSONA = {
    "sop": "sop_writer",
    "framework": "framework_author",
    "policy": "policy_writer",
}


router = APIRouter(prefix="/company", tags=["company-playbooks"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/playbooks")
@limiter.limit("100/minute;500/hour")
async def get_playbooks(request: Request, company_id: str,
    doc_type: Optional[str] = None,
    department_id: Optional[str] = None,
    tag: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Get all playbooks with current version content.
    Optional filters: doc_type, department_id, tag.
    """
    client = get_client(user)
    service_client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"playbooks": [], "departments": []}

    doc_query = client.table("org_documents") \
        .select("*") \
        .eq("company_id", company_uuid)

    if doc_type:
        doc_query = doc_query.eq("doc_type", doc_type)

    if tag:
        doc_query = doc_query.contains("tags", [tag])

    doc_result = doc_query.order("created_at", desc=True).execute()

    dept_result = service_client.table("departments") \
        .select("id, name, slug") \
        .eq("company_id", company_uuid) \
        .execute()

    dept_map = {d["id"]: d for d in (dept_result.data or [])}

    if not doc_result.data:
        departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]
        return {"playbooks": [], "departments": departments}

    doc_ids = [doc["id"] for doc in doc_result.data]
    version_result = client.table("org_document_versions") \
        .select("*") \
        .in_("document_id", doc_ids) \
        .eq("is_current", True) \
        .execute()

    version_map = {v["document_id"]: v for v in (version_result.data or [])}

    dept_mapping_result = client.table("org_document_departments") \
        .select("document_id, department_id") \
        .in_("document_id", doc_ids) \
        .execute()

    additional_depts_map: dict[str, list[str]] = {}
    for mapping in (dept_mapping_result.data or []):
        doc_id = mapping["document_id"]
        if doc_id not in additional_depts_map:
            additional_depts_map[doc_id] = []
        additional_depts_map[doc_id].append(mapping["department_id"])

    playbooks = []
    for doc in doc_result.data:
        version = version_map.get(doc["id"])
        if version:
            doc["content"] = version.get("content", "")
            doc["version"] = version.get("version", 1)
        else:
            doc["content"] = ""
            doc["version"] = 0

        doc["additional_departments"] = additional_depts_map.get(doc["id"], [])

        if department_id:
            is_owner = doc.get("department_id") == department_id
            is_visible = department_id in doc["additional_departments"]
            if not (is_owner or is_visible):
                continue

        dept_id = doc.get("department_id")
        if dept_id and dept_id in dept_map:
            doc["department_name"] = dept_map[dept_id].get("name")
            doc["department_slug"] = dept_map[dept_id].get("slug")

        playbooks.append(doc)

    departments = [{"id": d["id"], "name": d["name"], "slug": d["slug"]} for d in (dept_result.data or [])]

    return {"playbooks": playbooks, "departments": departments}


@router.get("/{company_id}/playbooks/tags")
@limiter.limit("100/minute;500/hour")
async def get_playbook_tags(request: Request, company_id: str, user=Depends(get_current_user)):
    """Get predefined playbook tag categories."""
    predefined_tags = [
        {"tag": "deployment", "description": "Deployment and release procedures"},
        {"tag": "security", "description": "Security protocols and guidelines"},
        {"tag": "onboarding", "description": "Team member onboarding processes"},
        {"tag": "incident-response", "description": "Incident handling and escalation"},
        {"tag": "communication", "description": "Communication standards and protocols"},
        {"tag": "workflow", "description": "Standard workflows and processes"},
        {"tag": "approval", "description": "Approval and sign-off procedures"},
        {"tag": "compliance", "description": "Compliance and regulatory requirements"},
        {"tag": "quality", "description": "Quality assurance and testing"},
        {"tag": "technical", "description": "Technical standards and architecture"},
        {"tag": "business", "description": "Business operations and strategy"},
        {"tag": "hr", "description": "Human resources and personnel"},
        {"tag": "finance", "description": "Financial procedures and budgeting"},
        {"tag": "customer", "description": "Customer-facing processes"},
        {"tag": "planning", "description": "Planning and estimation"},
        {"tag": "review", "description": "Review and retrospective processes"},
        {"tag": "maintenance", "description": "Maintenance and updates"},
    ]
    return {"tags": predefined_tags}


@router.get("/{company_id}/playbooks/{playbook_id}")
@limiter.limit("100/minute;500/hour")
async def get_playbook(request: Request, company_id: ValidCompanyId, playbook_id: str, user=Depends(get_current_user)):
    """Get a single playbook with its current version content."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    try:
        uuid.UUID(playbook_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid playbook ID format")

    doc_result = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Playbook not found")

    doc = doc_result.data

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
@limiter.limit("20/minute")
async def create_playbook(request: Request, company_id: ValidCompanyId, data: PlaybookCreate, user=Depends(get_current_user)):
    """Create a new playbook with initial version."""
    import re
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Auto-generate slug from title if not provided
    slug = data.slug
    if not slug:
        # Convert title to slug: lowercase, replace spaces with hyphens, remove special chars
        slug = data.title.lower().strip()
        slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special characters except hyphens
        slug = re.sub(r'[\s_]+', '-', slug)   # Replace spaces/underscores with hyphens
        slug = re.sub(r'-+', '-', slug)       # Collapse multiple hyphens
        slug = slug.strip('-')                # Remove leading/trailing hyphens

    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": data.department_id,
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": slug,
        "summary": data.summary,
        "auto_inject": data.auto_inject,
        "tags": data.tags
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    version_result = client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": data.content,
        "status": "active",
        "is_current": True,
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    if not version_result.data:
        client.table("org_documents").delete().eq("id", doc_id).execute()
        raise HTTPException(status_code=400, detail="Failed to create playbook version")

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
@limiter.limit("30/minute;100/hour")
async def update_playbook(request: Request, company_id: ValidCompanyId, playbook_id: ValidPlaybookId, data: PlaybookUpdate, user=Depends(get_current_user)):
    """Update a playbook - creates a new version if content changed."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    doc_result = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    version_result = client.table("org_document_versions") \
        .select("*") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .execute()

    current_version = version_result.data[0] if version_result.data else None
    current_version_num = current_version["version"] if current_version else 0

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

    if data.content is not None and (not current_version or data.content != current_version.get("content")):
        if current_version:
            client.table("org_document_versions") \
                .update({"is_current": False}) \
                .eq("id", current_version["id"]) \
                .execute()

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

    if data.additional_departments is not None:
        client.table("org_document_departments") \
            .delete() \
            .eq("document_id", playbook_id) \
            .execute()

        if data.additional_departments:
            dept_mappings = [
                {"document_id": playbook_id, "department_id": dept_id}
                for dept_id in data.additional_departments
            ]
            client.table("org_document_departments").insert(dept_mappings).execute()

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
@limiter.limit("20/minute;50/hour")
async def delete_playbook(request: Request, company_id: ValidCompanyId, playbook_id: ValidPlaybookId, user=Depends(get_current_user)):
    """Delete a playbook permanently."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    existing = client.table("org_documents") \
        .select("id, title") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    playbook_title = existing.data.get("title", "Playbook")

    client.table("org_document_departments") \
        .delete() \
        .eq("document_id", playbook_id) \
        .execute()

    client.table("org_document_versions") \
        .delete() \
        .eq("document_id", playbook_id) \
        .execute()

    client.table("org_documents") \
        .delete() \
        .eq("id", playbook_id) \
        .execute()

    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Deleted: {playbook_title}",
        description="Playbook was permanently deleted",
        related_id=playbook_id,
        related_type="playbook"
    )

    return {"success": True, "message": f"Playbook '{playbook_title}' deleted"}


# =============================================================================
# AI-ASSISTED PLAYBOOK STRUCTURING
# =============================================================================

async def _detect_doc_type(description: str, company_id: Optional[str]) -> str:
    """
    Use AI to determine the document type from the description.
    Returns 'sop', 'framework', or 'policy'.
    """
    from ...openrouter import query_model
    from ...security import log_app_event

    # Quick classification prompt - lightweight, uses fast model
    system_prompt = """You are a document classifier. Analyze the description and determine the document type.

- SOP (Standard Operating Procedure): Step-by-step instructions, "how to do" tasks, repeatable processes
- Framework: Conceptual structures, principles, guidelines, "how to think about" topics
- Policy: Rules, requirements, boundaries, "what must/must not be done"

Return ONLY one word: sop, framework, or policy"""

    user_prompt = f'Classify this: "{description[:500]}"'

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Use a fast, cheap model for classification
    classification_models = ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"]

    for model in classification_models:
        try:
            result = await query_model(model=model, messages=messages)

            # Track usage
            if company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type='playbook_type_detection',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass

            if result and result.get('content'):
                doc_type = result['content'].strip().lower()
                # Clean any extra characters
                doc_type = doc_type.replace('"', '').replace("'", '').strip()
                if doc_type in ['sop', 'framework', 'policy']:
                    log_app_event(
                        "PLAYBOOK_TYPE_DETECTED",
                        level="INFO",
                        model=model,
                        detected_type=doc_type
                    )
                    return doc_type

        except Exception as e:
            log_app_event(
                "PLAYBOOK_TYPE_DETECTION_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    # Default to SOP if detection fails
    return "sop"


async def _generate_playbook_content(
    doc_type: str,
    description: str,
    company_id: Optional[str]
) -> dict:
    """
    Generate playbook content using the type-specific persona.
    Returns {"title": str, "content": str} or None if all models fail.
    """
    from ...openrouter import query_model
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    # Get the type-specific persona
    persona_key = DOC_TYPE_TO_PERSONA.get(doc_type, "sop_writer")
    persona = await get_db_persona_with_fallback(persona_key)
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    if isinstance(models, str):
        models = json.loads(models)

    # Build the user prompt based on doc_type
    doc_type_labels = {
        "sop": "Standard Operating Procedure (SOP)",
        "framework": "Framework",
        "policy": "Policy"
    }
    type_label = doc_type_labels.get(doc_type, "Document")

    user_prompt = f"""Create a complete {type_label} from this description:

"{description}"

Structure your response as valid JSON with exactly these fields:
{{
  "title": "A clear, professional title for this {type_label}",
  "content": "The full document content in markdown format with proper sections"
}}

Write comprehensive, production-ready content following your expertise as a {type_label} specialist."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Try each model in the fallback chain
    for model in models:
        try:
            result = await query_model(model=model, messages=messages)

            # Track usage
            if company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type='playbook_generation',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass

            if result and result.get('content'):
                content = result['content']

                # Clean up JSON from markdown code blocks if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                if '```' in content:
                    content = content.split('```')[0]
                content = content.strip()

                try:
                    parsed = json.loads(content)

                    # Validate required fields
                    if not parsed.get('title'):
                        continue

                    log_app_event(
                        "PLAYBOOK_GENERATED",
                        level="INFO",
                        model=model,
                        persona=persona_key,
                        title=parsed.get('title'),
                        doc_type=doc_type
                    )

                    return {
                        "title": parsed.get('title'),
                        "content": parsed.get('content', f"# {parsed.get('title')}\n\n")
                    }

                except json.JSONDecodeError:
                    continue

        except Exception as e:
            log_app_event(
                "PLAYBOOK_GENERATION_ERROR",
                level="WARNING",
                model=model,
                persona=persona_key,
                error=str(e)
            )
            continue

    # All models failed
    log_app_event(
        "PLAYBOOK_GENERATION_ALL_FAILED",
        level="ERROR",
        persona=persona_key,
        doc_type=doc_type
    )
    return None


@router.post("/playbooks/structure")
@limiter.limit("10/minute;50/hour")
async def structure_playbook(
    request: Request,
    structure_request: StructurePlaybookRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to structure a natural language playbook description into
    a title, document type, and full content.

    Two-phase approach:
    1. Determine doc_type (from request or AI detection)
    2. Call the specialized persona (sop_writer, framework_author, policy_writer)

    Request body:
        - description: The natural language description
        - company_id: Optional, for usage tracking
        - doc_type: Optional, user's preselection ('sop', 'framework', 'policy')

    Returns:
        {
            "structured": {
                "title": "Playbook Title",
                "doc_type": "sop" | "framework" | "policy",
                "content": "# Title\\n\\n## Section 1\\n..."
            }
        }
    """
    from ...openrouter import MOCK_LLM
    from ...security import log_app_event

    description = structure_request.description[:10000] if structure_request.description else ""

    # Handle mock mode for testing
    if MOCK_LLM:
        # Use provided doc_type or detect from description
        doc_type = structure_request.doc_type
        if not doc_type:
            desc_lower = description.lower()
            if "how to" in desc_lower or "step" in desc_lower or "process" in desc_lower:
                doc_type = "sop"
            elif "policy" in desc_lower or "rule" in desc_lower or "must" in desc_lower:
                doc_type = "policy"
            else:
                doc_type = "framework"

        mock_content = {
            "sop": {
                "title": "Standard Operating Procedure",
                "content": "# Standard Operating Procedure\n\n## Purpose\n\nThis SOP outlines the steps to complete the process.\n\n## Steps\n\n1. Step one\n2. Step two\n3. Step three\n\n## Notes\n\nAdditional information here."
            },
            "policy": {
                "title": "Company Policy",
                "content": "# Company Policy\n\n## Purpose\n\nThis policy establishes guidelines and boundaries.\n\n## Scope\n\nApplies to all team members.\n\n## Policy Statement\n\nKey rules and requirements.\n\n## Compliance\n\nEnforcement and exceptions."
            },
            "framework": {
                "title": "Decision Framework",
                "content": "# Decision Framework\n\n## Overview\n\nA structured approach to decision-making.\n\n## Principles\n\n- Principle 1\n- Principle 2\n- Principle 3\n\n## Application\n\nHow to apply this framework."
            }
        }

        return {
            "structured": {
                "title": mock_content[doc_type]["title"],
                "doc_type": doc_type,
                "content": mock_content[doc_type]["content"]
            }
        }

    # PHASE 1: Determine document type
    # Use provided doc_type if valid, otherwise detect from description
    doc_type = structure_request.doc_type
    if doc_type and doc_type in ['sop', 'framework', 'policy']:
        log_app_event(
            "PLAYBOOK_TYPE_PRESELECTED",
            level="INFO",
            doc_type=doc_type
        )
    else:
        # AI detection of document type
        doc_type = await _detect_doc_type(description, structure_request.company_id)

    # PHASE 2: Generate content using the type-specific persona
    result = await _generate_playbook_content(
        doc_type=doc_type,
        description=description,
        company_id=structure_request.company_id
    )

    if result:
        return {
            "structured": {
                "title": result["title"],
                "doc_type": doc_type,
                "content": result["content"]
            }
        }

    # Fallback if all generation attempts failed
    log_app_event("PLAYBOOK_STRUCTURE_FALLBACK", level="ERROR")

    words = description.split()[:5]
    fallback_title = " ".join(w.capitalize() for w in words) if words else "New Playbook"

    return {
        "structured": {
            "title": fallback_title,
            "doc_type": doc_type,
            "content": f"# {fallback_title}\n\n{description[:500]}"
        }
    }
