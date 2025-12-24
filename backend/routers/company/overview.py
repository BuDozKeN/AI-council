"""
Company Overview Router

Endpoints for company overview and context management:
- Get company overview with stats
- Update company context
- Merge new info into company context
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...auth import get_current_user
from .utils import (
    get_service_client,
    verify_company_access,
    resolve_company_id,
    ValidCompanyId,
)


router = APIRouter(prefix="/api/company", tags=["company-overview"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CompanyContextUpdate(BaseModel):
    """Update company context."""
    context_md: str


class CompanyContextMergeRequest(BaseModel):
    """Request to merge new info into company context."""
    existing_context: str
    question: str
    answer: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/overview")
async def get_company_overview(company_id: ValidCompanyId, user=Depends(get_current_user)):
    """
    Get company overview with stats from DATABASE.
    Returns company info + counts of departments, roles, playbooks, decisions.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    verify_company_access(client, company_uuid, user)

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

    # Count decisions
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


@router.put("/{company_id}/context")
async def update_company_context(company_id: ValidCompanyId, data: CompanyContextUpdate, user=Depends(get_current_user)):
    """
    Update the company context markdown.
    This is the master context document containing mission, goals, strategy, etc.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    verify_company_access(client, company_uuid, user)

    result = client.table("companies") \
        .update({"context_md": data.context_md}) \
        .eq("id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    return {"company": result.data[0]}


@router.post("/{company_id}/context/merge")
async def merge_company_context(
    company_id: ValidCompanyId,
    request: CompanyContextMergeRequest,
    user=Depends(get_current_user)
):
    """
    Intelligently merge new context information into existing company context.
    Uses AI to incorporate user's answer into the appropriate section.
    """
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import WRITE_ASSIST_PERSONAS

    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    verify_company_access(client, company_uuid, user)

    existing = request.existing_context or ""
    question = request.question
    answer = request.answer

    if MOCK_LLM:
        merged = existing + f"\n\n## Additional Information\n\n**{question}**\n{answer}"
        client.table("companies").update({
            "context_md": merged
        }).eq("id", company_uuid).execute()
        return {"merged_context": merged}

    persona = WRITE_ASSIST_PERSONAS.get("company-context", {})
    system_prompt = persona.get("prompt", "You are a helpful business writer.")

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

    models = ["anthropic/claude-3-5-haiku-20241022", "openai/gpt-4o-mini"]

    merged = None

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
        except Exception:
            continue

    if merged is None:
        merged = existing + f"\n\n## Additional Information\n\n**{question}**\n{answer}"

    client.table("companies").update({
        "context_md": merged
    }).eq("id", company_uuid).execute()

    return {"merged_context": merged}
