"""
Company Team Router

Endpoints for department and role management:
- Get team structure (departments with roles)
- Create/update departments
- Create/update/get roles
- AI-assisted department structuring
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime, timezone
import json
import logging

from ...auth import get_current_user, get_effective_user
from ...i18n import t, get_locale_from_request

logger = logging.getLogger(__name__)
from .utils import (
    get_client,
    get_service_client,
    verify_company_access,
    resolve_company_id,
    save_internal_llm_usage,
    ValidCompanyId,
    ValidDeptId,
    ValidRoleId,
    DepartmentCreate,
    DepartmentUpdate,
    RoleCreate,
    RoleUpdate,
)

# Import shared rate limiter (ensures limits are tracked globally)
from ...rate_limit import limiter


# =============================================================================
# HELPER FUNCTIONS FOR AI STRUCTURING
# =============================================================================

def _clean_json_from_markdown(content: str) -> str:
    """Extract JSON from markdown code blocks if present."""
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    if '```' in content:
        content = content.split('```')[0]
    return content.strip()


def _get_mock_department_response(description: str) -> Dict[str, Any]:
    """Generate a mock department response based on keywords in description."""
    desc_lower = description.lower()

    if any(kw in desc_lower for kw in ["engineer", "tech", "develop"]):
        return {
            "name": "Engineering",
            "description": "Responsible for building and maintaining technical products and infrastructure.",
            "suggested_roles": ["Software Engineer", "Tech Lead", "DevOps Engineer"]
        }
    elif any(kw in desc_lower for kw in ["market", "brand"]):
        return {
            "name": "Marketing",
            "description": "Drives brand awareness, customer acquisition, and market positioning.",
            "suggested_roles": ["Marketing Manager", "Content Strategist", "Growth Analyst"]
        }
    else:
        return {
            "name": "Operations",
            "description": "Manages day-to-day business operations and process optimization.",
            "suggested_roles": ["Operations Manager", "Process Analyst", "Coordinator"]
        }


def _get_mock_role_response(description: str) -> Dict[str, Any]:
    """Generate a mock role response based on keywords in description."""
    desc_lower = description.lower()

    if any(kw in desc_lower for kw in ["engineer", "develop", "code"]):
        return {
            "name": "Software Engineer",
            "title": "Senior Software Engineer",
            "description": "Designs, develops, and maintains software applications and systems.",
            "responsibilities": [
                "Write clean, maintainable code",
                "Review pull requests and mentor junior developers",
                "Collaborate with product team on requirements"
            ],
            "system_prompt": """You are a Senior Software Engineer with 12+ years of experience building scalable systems.

Your expertise includes:
- System architecture and design patterns
- Code quality and best practices
- Performance optimization
- Technical mentorship

Your approach:
You think in terms of maintainability, scalability, and developer experience. You balance pragmatism with technical excellence.

When advising, you:
- Consider long-term implications of technical decisions
- Advocate for clean, testable code
- Challenge over-engineering while ensuring quality"""
        }
    elif any(kw in desc_lower for kw in ["manager", "lead"]):
        return {
            "name": "Team Lead",
            "title": "Engineering Team Lead",
            "description": "Leads a team of engineers, coordinating work and ensuring delivery.",
            "responsibilities": [
                "Manage team priorities and sprint planning",
                "Conduct 1:1s and performance reviews",
                "Remove blockers and escalate issues"
            ],
            "system_prompt": """You are an Engineering Team Lead with 10+ years of experience leading high-performing teams.

Your expertise includes:
- Team management and development
- Agile methodologies and delivery
- Stakeholder communication
- Technical strategy

Your approach:
You lead with empathy while maintaining high standards. You balance team wellbeing with business objectives.

When advising, you:
- Focus on people and process improvements
- Identify and remove blockers proactively
- Communicate clearly across technical and business audiences"""
        }
    else:
        return {
            "name": "Specialist",
            "title": "Operations Specialist",
            "description": "Handles specialized tasks and processes within the organization.",
            "responsibilities": [
                "Execute daily operational tasks",
                "Document processes and procedures",
                "Report on key metrics"
            ],
            "system_prompt": """You are an Operations Specialist with deep expertise in process optimization.

Your expertise includes:
- Process documentation and improvement
- Operational efficiency
- Cross-functional coordination
- Metrics and reporting

Your approach:
You are detail-oriented and systematic, ensuring nothing falls through the cracks.

When advising, you:
- Focus on practical, implementable solutions
- Consider operational impact of decisions
- Ensure processes are documented and repeatable"""
        }


async def _query_with_fallback(
    models: List[str],
    messages: List[Dict[str, Any]],
    company_id: str | None,
    operation_type: str,
    parse_json: bool = True
) -> Dict[str, Any] | None:
    """
    Query models with fallback chain, optionally parse JSON response.

    Returns:
        For parse_json=True: Parsed JSON dict or None if all models fail
        For parse_json=False: {"content": raw_content} or None
    """
    from ...openrouter import query_model
    from ...security import log_app_event

    for model in models:
        try:
            result = await query_model(model=model, messages=messages)

            # Track internal LLM usage if company_id provided
            if company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type=operation_type,
                        model=model,
                        usage=result['usage']
                    )
                except Exception as e:
                    logger.debug("Failed to track LLM usage for %s: %s", operation_type, e)

            if result and result.get('content'):
                content = result['content']

                if parse_json:
                    # Clean up JSON from markdown code blocks
                    content = _clean_json_from_markdown(content)
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        continue  # Try next model
                else:
                    # Return raw content (for system_prompt generation)
                    content = _clean_json_from_markdown(content) if content.startswith('```') else content.strip()
                    if len(content) > 50:  # Basic validation
                        return {"content": content, "model": model}
                    continue

        except Exception as e:
            log_app_event(
                f"{operation_type.upper()}_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    return None


async def _structure_role_phase1(
    description: str,
    company_id: str | None
) -> Dict[str, Any] | None:
    """
    Phase 1: Use role_designer persona to generate role name, title, description, responsibilities.
    Returns structured dict or None if all models fail.
    """
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    role_persona = await get_db_persona_with_fallback('role_designer')
    role_system_prompt = role_persona.get('system_prompt', '')
    role_models = role_persona.get('model_preferences', ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001'])

    if isinstance(role_models, str):
        role_models = json.loads(role_models)

    role_user_prompt = f"""Create a role definition from this description:

"{description}"

Return valid JSON only:
{{
  "name": "Role Name (2-4 words)",
  "title": "Full Job Title",
  "description": "One to two sentences explaining what this role does.",
  "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
}}"""

    messages = [
        {"role": "system", "content": role_system_prompt},
        {"role": "user", "content": role_user_prompt}
    ]

    structured = await _query_with_fallback(
        models=role_models,
        messages=messages,
        company_id=company_id,
        operation_type='role_structuring',
        parse_json=True
    )

    if structured and structured.get('name'):
        # Ensure responsibilities is a list
        if not isinstance(structured.get('responsibilities'), list):
            structured['responsibilities'] = []
        log_app_event(
            "ROLE_STRUCTURED_PHASE1",
            level="INFO",
            name=structured.get('name')
        )
        return structured

    return None


async def _structure_role_phase2(
    structured: Dict[str, Any],
    company_id: str | None
) -> Dict[str, Any]:
    """
    Phase 2: Use persona_architect to generate system_prompt for AI advisor behavior.
    Modifies structured dict in place and returns it.
    """
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    persona_architect = await get_db_persona_with_fallback('persona_architect')
    architect_system_prompt = persona_architect.get('system_prompt', '')
    architect_models = persona_architect.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    if isinstance(architect_models, str):
        architect_models = json.loads(architect_models)

    responsibilities_text = "\n".join(f"- {r}" for r in structured.get('responsibilities', []))

    architect_user_prompt = f"""Create an AI advisor system prompt for this role:

Role: {structured.get('name')}
Title: {structured.get('title')}
Description: {structured.get('description')}
Responsibilities:
{responsibilities_text}

Write a system prompt that defines how an AI advisor in this role should behave, including:
- Their expertise and background
- Their approach and communication style
- How they should advise and what they prioritize

Return ONLY the system prompt text (no JSON, no code blocks, no explanations). The prompt should be 150-300 words and ready to use directly."""

    messages = [
        {"role": "system", "content": architect_system_prompt},
        {"role": "user", "content": architect_user_prompt}
    ]

    result = await _query_with_fallback(
        models=architect_models,
        messages=messages,
        company_id=company_id,
        operation_type='role_persona_generation',
        parse_json=False
    )

    if result and result.get('content'):
        structured['system_prompt'] = result['content']
        log_app_event(
            "ROLE_STRUCTURED_PHASE2",
            level="INFO",
            name=structured.get('name'),
            prompt_length=len(result['content'])
        )
    else:
        # Fallback system prompt
        log_app_event("ROLE_STRUCTURE_PHASE2_FAILED", level="WARNING")
        structured['system_prompt'] = f"""You are a {structured.get('title', structured.get('name'))} with deep expertise in your domain.

Your responsibilities include:
{responsibilities_text if responsibilities_text else '- Providing expert guidance in your area'}

You advise with clarity, professionalism, and a focus on practical outcomes."""

    return structured


# =============================================================================
# PYDANTIC MODELS FOR AI STRUCTURING
# =============================================================================

class StructureDepartmentRequest(BaseModel):
    """Request to structure a department from natural language description."""
    description: str = Field(..., max_length=5000)
    company_id: Optional[str] = Field(None, max_length=100)  # For usage tracking


class StructureRoleRequest(BaseModel):
    """Request to structure a role from natural language description."""
    description: str = Field(..., max_length=5000)
    department_id: Optional[str] = Field(None, max_length=100)  # Context for role
    company_id: Optional[str] = Field(None, max_length=100)  # For usage tracking


router = APIRouter(prefix="/company", tags=["company-team"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/team")
@limiter.limit("100/minute;500/hour")
async def get_team(request: Request, company_id: ValidCompanyId, user=Depends(get_effective_user)):
    """
    Get all departments with their roles from DATABASE.
    Returns hierarchical structure: departments → roles.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    verify_company_access(client, company_uuid, user)

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
    roles_by_dept: dict[str, list[dict[str, Any]]] = {}
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
            "llm_preset": dept.get("llm_preset", "balanced"),
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
@limiter.limit("30/minute;100/hour")
async def create_department(request: Request, company_id: ValidCompanyId, data: DepartmentCreate, user=Depends(get_effective_user)):
    """Create a new department."""
    locale = get_locale_from_request(request)
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
        raise HTTPException(status_code=400, detail=t('errors.department_create_failed', locale))

    return {"department": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}")
@limiter.limit("30/minute;100/hour")
async def update_department(request: Request, company_id: ValidCompanyId, dept_id: ValidDeptId, data: DepartmentUpdate, user=Depends(get_effective_user)):
    """Update a department."""
    locale = get_locale_from_request(request)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = client.table("departments") \
        .update(update_data) \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=t('errors.department_not_found', locale))

    return {"department": result.data[0]}


@router.post("/{company_id}/departments/{dept_id}/roles")
@limiter.limit("30/minute;100/hour")
async def create_role(request: Request, company_id: ValidCompanyId, dept_id: ValidDeptId, data: RoleCreate, user=Depends(get_effective_user)):
    """Create a new role in a department."""
    locale = get_locale_from_request(request)
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
        raise HTTPException(status_code=400, detail=t('errors.role_create_failed', locale))

    return {"role": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}/roles/{role_id}")
@limiter.limit("30/minute;100/hour")
async def update_role(request: Request, company_id: ValidCompanyId, dept_id: ValidDeptId, role_id: ValidRoleId, data: RoleUpdate, user=Depends(get_effective_user)):
    """Update a role."""
    locale = get_locale_from_request(request)
    client = get_client(user)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = client.table("roles") \
        .update(update_data) \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=t('errors.role_not_found', locale))

    return {"role": result.data[0]}


@router.get("/{company_id}/departments/{dept_id}/roles/{role_id}")
@limiter.limit("100/minute;500/hour")
async def get_role(request: Request, company_id: ValidCompanyId, dept_id: ValidDeptId, role_id: ValidRoleId, user=Depends(get_effective_user)):
    """Get a single role with full details including system prompt."""
    locale = get_locale_from_request(request)
    client = get_client(user)

    result = client.table("roles") \
        .select("*") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=t('errors.role_not_found', locale))

    return {"role": result.data}


# =============================================================================
# DELETE OPERATIONS
# =============================================================================

@router.delete("/{company_id}/departments/{dept_id}")
@limiter.limit("10/minute;50/hour")
async def delete_department(
    request: Request,
    company_id: ValidCompanyId,
    dept_id: ValidDeptId,
    user=Depends(get_effective_user)
):
    """
    Delete a department and all its roles permanently.
    This is a cascading delete - all roles in the department are also removed.
    """
    from ...security import log_app_event

    locale = get_locale_from_request(request)
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get department info for logging
    dept_result = client.table("departments") \
        .select("name") \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not dept_result.data:
        raise HTTPException(status_code=404, detail=t('errors.department_not_found', locale))

    dept_name = dept_result.data.get("name", "Unknown")

    # Count roles that will be deleted
    roles_result = client.table("roles") \
        .select("id") \
        .eq("department_id", dept_id) \
        .execute()

    role_count = len(roles_result.data) if roles_result.data else 0

    # Delete all roles in this department first
    if role_count > 0:
        client.table("roles") \
            .delete() \
            .eq("department_id", dept_id) \
            .execute()

    # Delete the department
    delete_result = client.table("departments") \
        .delete() \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .execute()

    if not delete_result.data:
        raise HTTPException(status_code=404, detail=t('errors.department_delete_failed', locale))

    log_app_event(
        "DEPARTMENT_DELETED",
        level="INFO",
        department_name=dept_name,
        deleted_roles=role_count,
        company_id=str(company_uuid)
    )

    return {
        "success": True,
        "deleted_department": dept_name,
        "deleted_roles": role_count
    }


@router.delete("/{company_id}/departments/{dept_id}/roles/{role_id}")
@limiter.limit("20/minute;100/hour")
async def delete_role(
    request: Request,
    company_id: ValidCompanyId,
    dept_id: ValidDeptId,
    role_id: ValidRoleId,
    user=Depends(get_effective_user)
):
    """Delete a role permanently."""
    from ...security import log_app_event

    locale = get_locale_from_request(request)
    client = get_client(user)

    # Get role info for logging
    role_result = client.table("roles") \
        .select("name") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not role_result.data:
        raise HTTPException(status_code=404, detail=t('errors.role_not_found', locale))

    role_name = role_result.data.get("name", "Unknown")

    # Delete the role
    delete_result = client.table("roles") \
        .delete() \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .execute()

    if not delete_result.data:
        raise HTTPException(status_code=404, detail=t('errors.role_delete_failed', locale))

    log_app_event(
        "ROLE_DELETED",
        level="INFO",
        role_name=role_name,
        department_id=dept_id
    )

    return {
        "success": True,
        "deleted_role": role_name
    }


# =============================================================================
# AI-ASSISTED DEPARTMENT STRUCTURING
# =============================================================================

@router.post("/departments/structure")
@limiter.limit("10/minute;50/hour")
async def structure_department(
    request: Request,
    structure_request: StructureDepartmentRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to structure a natural language department description into
    a department name, description, and suggested roles.

    Uses the 'department_designer' persona from the database.

    Returns:
        {
            "structured": {
                "name": "Clear Department Name",
                "description": "What this department does",
                "suggested_roles": ["Role 1", "Role 2", "Role 3"]
            }
        }
    """
    from ...openrouter import MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    # Handle mock mode for testing
    if MOCK_LLM:
        return {"structured": _get_mock_department_response(structure_request.description)}

    # Get the department_designer persona from database
    persona = await get_db_persona_with_fallback('department_designer')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001'])

    if isinstance(models, str):
        models = json.loads(models)

    # Build the user prompt
    description = structure_request.description[:5000] if structure_request.description else ""

    user_prompt = f"""Create a department definition from this description:

"{description}"

Return valid JSON only:
{{
  "name": "Clear Department Name (2-4 words)",
  "description": "One to two sentences explaining what this department does.",
  "suggested_roles": ["Role 1", "Role 2", "Role 3"]
}}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Query models with fallback
    structured = await _query_with_fallback(
        models=models,
        messages=messages,
        company_id=structure_request.company_id,
        operation_type='department_structuring',
        parse_json=True
    )

    # Validate and return successful result
    if structured and structured.get('name'):
        # Ensure suggested_roles is a list
        if not isinstance(structured.get('suggested_roles'), list):
            structured['suggested_roles'] = []
        log_app_event(
            "DEPARTMENT_STRUCTURED",
            level="INFO",
            name=structured.get('name')
        )
        return {"structured": structured}

    # All models failed - return a basic fallback
    log_app_event("DEPARTMENT_STRUCTURE_ALL_FAILED", level="ERROR")

    words = structure_request.description.split()[:3]
    fallback_name = " ".join(w.capitalize() for w in words) if words else "New Department"

    return {
        "structured": {
            "name": fallback_name,
            "description": structure_request.description[:200],
            "suggested_roles": []
        }
    }


# =============================================================================
# AI-ASSISTED ROLE STRUCTURING
# =============================================================================

@router.post("/roles/structure")
@limiter.limit("10/minute;50/hour")
async def structure_role(
    request: Request,
    structure_request: StructureRoleRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to structure a natural language role description into
    a role name, title, description, responsibilities, and system_prompt.

    Two-phase process:
    1. 'role_designer' persona generates: name, title, description, responsibilities
    2. 'persona_architect' persona generates: system_prompt (AI advisor behavior)

    Returns:
        {
            "structured": {
                "name": "Role Name",
                "title": "Full Job Title",
                "description": "What this role does",
                "responsibilities": ["Resp 1", "Resp 2", "Resp 3"],
                "system_prompt": "You are a [role] with expertise in..."
            }
        }
    """
    from ...openrouter import MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    # Handle mock mode for testing
    if MOCK_LLM:
        return {"structured": _get_mock_role_response(structure_request.description)}

    description = structure_request.description[:5000] if structure_request.description else ""

    # Phase 1: Generate role definition
    structured = await _structure_role_phase1(
        description=description,
        company_id=structure_request.company_id
    )

    if not structured:
        # All models failed - return fallback
        log_app_event("ROLE_STRUCTURE_PHASE1_FAILED", level="ERROR")
        words = description.split()[:3]
        fallback_name = " ".join(w.capitalize() for w in words) if words else "New Role"
        return {
            "structured": {
                "name": fallback_name,
                "title": fallback_name,
                "description": description[:200],
                "responsibilities": [],
                "system_prompt": ""
            }
        }

    # Phase 2: Generate system_prompt
    structured = await _structure_role_phase2(
        structured=structured,
        company_id=structure_request.company_id
    )

    log_app_event(
        "ROLE_STRUCTURED_COMPLETE",
        level="INFO",
        name=structured.get('name'),
        has_ai_prompt=bool(structured.get('system_prompt'))
    )

    return {"structured": structured}
