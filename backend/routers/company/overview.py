"""
Company Overview Router

Endpoints for company overview and context management:
- Get company overview with stats
- Update company context
- Merge new info into company context
- AI-assisted context generation (structure endpoint)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
import json

from ...auth import get_current_user
from ... import model_registry
from .utils import (
    get_service_client,
    verify_company_access,
    resolve_company_id,
    save_internal_llm_usage,
    ValidCompanyId,
)

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/company", tags=["company-overview"])


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


class StructureCompanyContextRequest(BaseModel):
    """Request to structure a company context from natural language description."""
    description: str = Field(..., max_length=10000)
    company_name: Optional[str] = Field(None, max_length=200)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/{company_id}/overview")
@limiter.limit("100/minute;500/hour")
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
@limiter.limit("30/minute;100/hour")
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
@limiter.limit("20/minute;50/hour")
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
    from .utils import save_internal_llm_usage

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

    # Use document_writer models from LLM Hub (same models used for playbook generation)
    models = await model_registry.get_models('document_writer') or ["openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022"]

    merged = None
    model_used = None
    usage_data = None

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
                model_used = model
                usage_data = result.get('usage')
                break
        except Exception:
            continue

    # Track usage if successful
    if company_uuid and model_used and usage_data:
        try:
            await save_internal_llm_usage(
                company_id=company_uuid,
                operation_type='context_merge',
                model=model_used,
                usage=usage_data
            )
        except Exception:
            pass  # Don't fail if tracking fails

    if merged is None:
        merged = existing + f"\n\n## Additional Information\n\n**{question}**\n{answer}"

    client.table("companies").update({
        "context_md": merged
    }).eq("id", company_uuid).execute()

    return {"merged_context": merged}


# =============================================================================
# AI-ASSISTED COMPANY CONTEXT GENERATION
# =============================================================================

@router.post("/{company_id}/context/structure")
@limiter.limit("10/minute;50/hour")
async def structure_company_context(
    request: Request,
    company_id: ValidCompanyId,
    structure_request: StructureCompanyContextRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to generate a comprehensive company context document from a natural language description.

    Uses the 'company_context_writer' persona from the database.

    Returns:
        {
            "structured": {
                "context_md": "# Company Overview\n\n..."
            }
        }
    """
    from ...openrouter import query_model, MOCK_LLM
    from ...personas import get_db_persona_with_fallback
    from ...security import log_app_event

    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Resource not found")

    verify_company_access(client, company_uuid, user)

    # Handle mock mode for testing
    if MOCK_LLM:
        company_name = structure_request.company_name or "Acme Corp"
        desc_lower = structure_request.description.lower()

        if "saas" in desc_lower or "software" in desc_lower or "tech" in desc_lower:
            mock_context = f"""# {company_name} - Company Context

**Last Updated:** 2026-01-05
**Version:** 1.0

## Company Overview

{company_name} is a B2B SaaS company building tools to help teams work more effectively. We're a seed-stage startup with a team of 8.

- **Industry:** Enterprise Software / Productivity
- **Stage:** Seed (raised $2M)
- **Team Size:** 8 people

## Mission & Vision

**Mission:** Make team collaboration effortless through intelligent automation.

**Vision:** Become the default productivity layer for modern teams.

**Core Values:**
- Ship fast, learn faster
- Customer obsession
- Transparency over politics

## Current Priorities

1. **Launch MVP to 10 pilot customers** (Q1)
2. **Achieve product-market fit signals** (40% weekly active usage)
3. **Build core integrations** (Slack, Notion, Linear)

**Not focusing on:**
- Enterprise sales motion
- International expansion
- Mobile apps

## Constraints & Resources

- **Budget:** $150K runway for next 6 months
- **Team:** 3 engineers, 2 designers, 1 PM, 2 founders
- **Timeline:** MVP by end of Q1
- **Technical:** AWS infrastructure, React/Node stack

## Decision-Making Culture

- Small team = fast decisions
- Default to action, iterate based on data
- Founders have final call on strategic decisions
- Engineers own technical architecture

## Key Policies & Standards

- **Security:** SOC 2 compliance planned for Q3
- **Code Quality:** PR reviews required, 80% test coverage target
- **Communication:** Async-first, daily standups optional
"""
        else:
            mock_context = f"""# {company_name} - Company Context

**Last Updated:** 2026-01-05
**Version:** 1.0

## Company Overview

{company_name} is focused on delivering value to our customers. We're building something meaningful.

- **Industry:** General Business
- **Stage:** Growth
- **Team Size:** Growing team

## Mission & Vision

**Mission:** Deliver exceptional value to our customers.

**Vision:** Be the leader in our space.

## Current Priorities

1. **Grow customer base**
2. **Improve product quality**
3. **Build team capabilities**

## Constraints & Resources

- **Budget:** Operating within means
- **Team:** Dedicated professionals
- **Timeline:** Quarterly planning cycles

## Decision-Making Culture

- Collaborative decision making
- Data-informed choices
- Clear ownership and accountability

## Key Policies & Standards

- Quality first
- Customer-centric approach
- Continuous improvement
"""
        return {"structured": {"context_md": mock_context}}

    # Get the company_context_writer persona from database
    persona = await get_db_persona_with_fallback('company_context_writer')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    if isinstance(models, str):
        models = json.loads(models)

    # Build the user prompt
    description = structure_request.description[:10000] if structure_request.description else ""
    company_name = structure_request.company_name or "the company"

    user_prompt = f"""Create a comprehensive company context document for {company_name} based on this description:

"{description}"

Generate a complete company context document in markdown format following your standard structure:
- Company Overview
- Mission & Vision
- Current Priorities
- Constraints & Resources
- Decision-Making Culture
- Key Policies & Standards

Include a metadata header with:
**Last Updated:** (today's date)
**Version:** 1.0

Make it specific to what was described. If information is missing, make reasonable inferences but mark assumptions.
Keep the total length to 500-800 words.

Return ONLY the markdown document, no explanations or commentary."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Try each model in the fallback chain
    for model in models:
        try:
            result = await query_model(model=model, messages=messages, max_tokens=2000)

            # Track internal LLM usage
            if result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_uuid,
                        operation_type='context_structuring',
                        model=model,
                        usage=result['usage']
                    )
                except Exception:
                    pass  # Don't fail if tracking fails

            if result and result.get('content'):
                content = result['content'].strip()

                # Clean up if wrapped in code blocks
                if content.startswith('```'):
                    content = content.split('```', 2)[1]
                    if content.startswith('markdown') or content.startswith('md'):
                        content = content.split('\n', 1)[1] if '\n' in content else content
                if '```' in content:
                    content = content.rsplit('```', 1)[0]
                content = content.strip()

                # Validate - should be substantial markdown
                if len(content) > 100 and '#' in content:
                    log_app_event(
                        "COMPANY_CONTEXT_STRUCTURED",
                        level="INFO",
                        model=model,
                        company_id=company_uuid,
                        content_length=len(content)
                    )
                    return {"structured": {"context_md": content}}

        except Exception as e:
            log_app_event(
                "COMPANY_CONTEXT_STRUCTURE_ERROR",
                level="WARNING",
                model=model,
                error=str(e)
            )
            continue

    # All models failed - return a basic template
    log_app_event("COMPANY_CONTEXT_STRUCTURE_ALL_FAILED", level="ERROR")

    fallback_context = f"""# {company_name} - Company Context

**Last Updated:** (Update this)
**Version:** 1.0

## Company Overview

{description[:500] if description else "Add your company description here."}

## Mission & Vision

**Mission:** (What is your company's mission?)

**Vision:** (Where are you headed?)

## Current Priorities

1. (Priority 1)
2. (Priority 2)
3. (Priority 3)

## Constraints & Resources

- **Budget:** (Your budget constraints)
- **Team:** (Team size and composition)
- **Timeline:** (Key deadlines)

## Decision-Making Culture

(How does your team make decisions?)

## Key Policies & Standards

(What are your non-negotiables?)
"""

    return {"structured": {"context_md": fallback_context}}
