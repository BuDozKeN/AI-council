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
from typing import Optional, List
from datetime import datetime
import json

from ...auth import get_current_user
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

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


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
async def get_team(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get all departments with their roles from DATABASE.
    Returns hierarchical structure: departments → roles.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

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

    return {"role": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def update_role(company_id: ValidCompanyId, dept_id: ValidDeptId, role_id: ValidRoleId, data: RoleUpdate, user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail="Resource not found")

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
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    # Handle mock mode for testing
    if MOCK_LLM:
        # Generate a sensible mock response based on input
        desc_lower = structure_request.description.lower()
        if "engineer" in desc_lower or "tech" in desc_lower or "develop" in desc_lower:
            return {
                "structured": {
                    "name": "Engineering",
                    "description": "Responsible for building and maintaining technical products and infrastructure.",
                    "suggested_roles": ["Software Engineer", "Tech Lead", "DevOps Engineer"]
                }
            }
        elif "market" in desc_lower or "brand" in desc_lower:
            return {
                "structured": {
                    "name": "Marketing",
                    "description": "Drives brand awareness, customer acquisition, and market positioning.",
                    "suggested_roles": ["Marketing Manager", "Content Strategist", "Growth Analyst"]
                }
            }
        else:
            return {
                "structured": {
                    "name": "Operations",
                    "description": "Manages day-to-day business operations and process optimization.",
                    "suggested_roles": ["Operations Manager", "Process Analyst", "Coordinator"]
                }
            }

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

    # Try each model in the fallback chain
    for model in models:
        try:
            result = await query_model(model=model, messages=messages)

            # Track internal LLM usage if company_id provided
            if structure_request.company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=structure_request.company_id,
                        operation_type='department_structuring',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass  # Don't fail structuring if tracking fails

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
                    structured = json.loads(content)

                    # Validate required fields
                    if not structured.get('name'):
                        continue  # Try next model

                    # Ensure suggested_roles is a list
                    if not isinstance(structured.get('suggested_roles'), list):
                        structured['suggested_roles'] = []

                    log_app_event(
                        "DEPARTMENT_STRUCTURED",
                        level="INFO",
                        model=model,
                        name=structured.get('name')
                    )

                    return {"structured": structured}

                except json.JSONDecodeError:
                    # Try next model if JSON parsing fails
                    continue
            else:
                continue

        except Exception as e:
            log_app_event(
                "DEPARTMENT_STRUCTURE_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    # All models failed - return a basic fallback
    log_app_event("DEPARTMENT_STRUCTURE_ALL_FAILED", level="ERROR")

    # Extract a simple name from the description
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
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    # Handle mock mode for testing
    if MOCK_LLM:
        desc_lower = structure_request.description.lower()
        if "engineer" in desc_lower or "develop" in desc_lower or "code" in desc_lower:
            return {
                "structured": {
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
            }
        elif "manager" in desc_lower or "lead" in desc_lower:
            return {
                "structured": {
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
            }
        else:
            return {
                "structured": {
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
            }

    # =========================================================================
    # PHASE 1: Role Designer - Generate name, title, description, responsibilities
    # =========================================================================
    role_persona = await get_db_persona_with_fallback('role_designer')
    role_system_prompt = role_persona.get('system_prompt', '')
    role_models = role_persona.get('model_preferences', ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001'])

    if isinstance(role_models, str):
        role_models = json.loads(role_models)

    description = structure_request.description[:5000] if structure_request.description else ""

    role_user_prompt = f"""Create a role definition from this description:

"{description}"

Return valid JSON only:
{{
  "name": "Role Name (2-4 words)",
  "title": "Full Job Title",
  "description": "One to two sentences explaining what this role does.",
  "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
}}"""

    role_messages = [
        {"role": "system", "content": role_system_prompt},
        {"role": "user", "content": role_user_prompt}
    ]

    structured = None
    role_model_used = None

    # Try each model in the fallback chain for role structuring
    for model in role_models:
        try:
            result = await query_model(model=model, messages=role_messages)

            # Track internal LLM usage if company_id provided
            if structure_request.company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=structure_request.company_id,
                        operation_type='role_structuring',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass  # Don't fail structuring if tracking fails

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
                    structured = json.loads(content)

                    # Validate required fields
                    if not structured.get('name'):
                        continue  # Try next model

                    # Ensure responsibilities is a list
                    if not isinstance(structured.get('responsibilities'), list):
                        structured['responsibilities'] = []

                    role_model_used = model
                    log_app_event(
                        "ROLE_STRUCTURED_PHASE1",
                        level="INFO",
                        model=model,
                        name=structured.get('name')
                    )
                    break  # Success - move to phase 2

                except json.JSONDecodeError:
                    continue
            else:
                continue

        except Exception as e:
            log_app_event(
                "ROLE_STRUCTURE_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    # Phase 1 fallback if all models failed
    if not structured:
        log_app_event("ROLE_STRUCTURE_PHASE1_FAILED", level="ERROR")
        words = structure_request.description.split()[:3]
        fallback_name = " ".join(w.capitalize() for w in words) if words else "New Role"
        structured = {
            "name": fallback_name,
            "title": fallback_name,
            "description": structure_request.description[:200],
            "responsibilities": [],
            "system_prompt": ""  # Empty fallback
        }
        return {"structured": structured}

    # =========================================================================
    # PHASE 2: Persona Architect - Generate system_prompt for AI advisor behavior
    # =========================================================================
    persona_architect = await get_db_persona_with_fallback('persona_architect')
    architect_system_prompt = persona_architect.get('system_prompt', '')
    architect_models = persona_architect.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    if isinstance(architect_models, str):
        architect_models = json.loads(architect_models)

    # Build context from the structured role
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

    architect_messages = [
        {"role": "system", "content": architect_system_prompt},
        {"role": "user", "content": architect_user_prompt}
    ]

    # Try each model in the fallback chain for persona generation
    for model in architect_models:
        try:
            result = await query_model(model=model, messages=architect_messages)

            # Track internal LLM usage
            if structure_request.company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=structure_request.company_id,
                        operation_type='role_persona_generation',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass

            if result and result.get('content'):
                system_prompt_content = result['content'].strip()

                # Clean up if wrapped in code blocks
                if system_prompt_content.startswith('```'):
                    system_prompt_content = system_prompt_content.split('```')[1]
                    if system_prompt_content.startswith('text') or system_prompt_content.startswith('markdown'):
                        system_prompt_content = system_prompt_content.split('\n', 1)[1] if '\n' in system_prompt_content else ''
                if '```' in system_prompt_content:
                    system_prompt_content = system_prompt_content.split('```')[0]
                system_prompt_content = system_prompt_content.strip()

                # Validate - should be substantial text
                if len(system_prompt_content) > 50:
                    structured['system_prompt'] = system_prompt_content
                    log_app_event(
                        "ROLE_STRUCTURED_PHASE2",
                        level="INFO",
                        model=model,
                        name=structured.get('name'),
                        prompt_length=len(system_prompt_content)
                    )
                    break

        except Exception as e:
            log_app_event(
                "ROLE_PERSONA_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    # Phase 2 fallback - generate a basic system prompt
    if 'system_prompt' not in structured or not structured['system_prompt']:
        log_app_event("ROLE_STRUCTURE_PHASE2_FAILED", level="WARNING")
        structured['system_prompt'] = f"""You are a {structured.get('title', structured.get('name'))} with deep expertise in your domain.

Your responsibilities include:
{responsibilities_text if responsibilities_text else '- Providing expert guidance in your area'}

You advise with clarity, professionalism, and a focus on practical outcomes."""

    log_app_event(
        "ROLE_STRUCTURED_COMPLETE",
        level="INFO",
        name=structured.get('name'),
        has_ai_prompt=bool(structured.get('system_prompt'))
    )

    return {"structured": structured}
