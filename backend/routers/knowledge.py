"""
Knowledge Router

Endpoints for knowledge base management:
- CRUD operations on knowledge entries
- AI-assisted decision extraction
- Knowledge counting and conversation linking
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, List
import asyncio
import re
import json

from ..auth import get_current_user
from .. import storage
from .. import knowledge
from ..config import config
from ..security import SecureHTTPException
from ..model_registry import model_registry

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/api", tags=["knowledge"])


# =============================================================================
# SECURITY HELPERS
# =============================================================================

UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def validate_uuid(value: str, field_name: str = "id") -> str:
    """Validate that a value is a valid UUID format."""
    if not value or not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must be a valid UUID"
        )
    return value


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CreateKnowledgeRequest(BaseModel):
    """Request to create a knowledge entry."""
    company_id: str
    title: str = Field(..., max_length=500)
    summary: Optional[str] = Field(None, max_length=10000)
    category: str = "technical_decision"
    department_id: Optional[str] = None
    role_id: Optional[str] = None
    project_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    # Structured decision fields
    problem_statement: Optional[str] = Field(None, max_length=10000)
    decision_text: Optional[str] = Field(None, max_length=10000)
    reasoning: Optional[str] = Field(None, max_length=10000)
    status: Optional[str] = None
    # Framework/SOP fields
    body_md: Optional[str] = Field(None, max_length=100000)
    version: Optional[str] = None
    # Knowledge consolidation fields
    auto_inject: bool = False
    scope: str = "company"
    tags: Optional[List[str]] = None


class UpdateKnowledgeRequest(BaseModel):
    """Request to update a knowledge entry."""
    title: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = Field(None, max_length=10000)
    category: Optional[str] = None
    department_id: Optional[str] = None
    role_id: Optional[str] = None
    project_id: Optional[str] = None
    problem_statement: Optional[str] = Field(None, max_length=10000)
    decision_text: Optional[str] = Field(None, max_length=10000)
    reasoning: Optional[str] = Field(None, max_length=10000)
    status: Optional[str] = None
    body_md: Optional[str] = Field(None, max_length=100000)
    version: Optional[str] = None
    auto_inject: Optional[bool] = None
    scope: Optional[str] = None
    tags: Optional[List[str]] = None


class ExtractDecisionRequest(BaseModel):
    """Request to extract decision from council response."""
    user_question: str = Field(..., max_length=10000)
    council_response: str = Field(..., max_length=50000)


# =============================================================================
# HELPER FUNCTION FOR AUTO-SYNTHESIS
# =============================================================================

async def _auto_synthesize_project_context(project_id: str, user: dict):
    """Background task to auto-regenerate project context after saving a decision."""
    from ..openrouter import query_model, MOCK_LLM
    from ..database import get_supabase_service
    from ..personas import get_db_persona_with_fallback
    from datetime import datetime

    if MOCK_LLM:
        return

    try:
        service_client = get_supabase_service()

        project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
        if not project_result.data:
            return

        project = project_result.data

        decisions_result = service_client.table("knowledge_entries") \
            .select("id, title, content, question, content_summary, created_at, department_ids") \
            .eq("project_id", project_id) \
            .eq("is_active", True) \
            .order("created_at", desc=False) \
            .execute()

        decisions = decisions_result.data or []
        if not decisions:
            return

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

        messages = [
            {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
            {"role": "user", "content": user_prompt}
        ]

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
                        new_context = result_data.get("context_md", "")

                        service_client.table("projects").update({
                            "context_md": new_context,
                            "updated_at": datetime.now().isoformat()
                        }).eq("id", project_id).execute()

                        return
                    except json.JSONDecodeError:
                        continue
                else:
                    continue

            except Exception:
                continue

    except Exception:
        pass


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("/knowledge")
async def create_knowledge_entry(
    request: CreateKnowledgeRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new knowledge entry."""
    from ..routers import company as company_router

    try:
        access_token = user.get("access_token")

        company_uuid = storage.resolve_company_id(request.company_id, access_token)

        department_uuid = storage.resolve_department_id(
            request.department_id,
            company_uuid,
            access_token
        )

        result = knowledge.create_knowledge_entry(
            user_id=user["id"],
            company_id=company_uuid,
            title=request.title,
            summary=request.summary,
            category=request.category,
            department_id=department_uuid,
            role_id=request.role_id,
            project_id=request.project_id,
            source_conversation_id=request.source_conversation_id,
            source_message_id=request.source_message_id,
            access_token=access_token,
            problem_statement=request.problem_statement,
            decision_text=request.decision_text,
            reasoning=request.reasoning,
            status=request.status,
            body_md=request.body_md,
            version=request.version,
            auto_inject=request.auto_inject,
            scope=request.scope,
            tags=request.tags
        )

        if result:
            await company_router.log_activity(
                company_id=company_uuid,
                event_type="decision",
                action="saved",
                title=request.title,
                description=request.summary[:200] if request.summary else None,
                department_id=department_uuid,
                related_id=result.get("id"),
                related_type="decision",
                conversation_id=request.source_conversation_id
            )

            if request.project_id:
                asyncio.create_task(
                    _auto_synthesize_project_context(request.project_id, user)
                )

            return result

        raise HTTPException(status_code=500, detail="Failed to create knowledge entry")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/knowledge/{company_id}")
async def get_knowledge_entries(
    company_id: str,
    department_id: Optional[str] = None,
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = Query("active"),
    search: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get knowledge entries for a company with filtering options."""
    try:
        access_token = user.get("access_token")

        company_uuid = storage.resolve_company_id(company_id, access_token)

        entries = knowledge.get_knowledge_entries(
            company_id=company_uuid,
            department_id=department_id,
            project_id=project_id,
            category=category,
            status=status,
            search=search,
            limit=limit,
            access_token=access_token,
            user_id=user["id"]
        )
        return {"entries": entries}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/conversations/{conversation_id}/knowledge-count")
async def get_knowledge_count_for_conversation(
    conversation_id: str,
    company_id: str,
    user: dict = Depends(get_current_user)
):
    """Get count of knowledge entries saved from a specific conversation."""
    try:
        access_token = user.get("access_token")
        company_uuid = storage.resolve_company_id(company_id, access_token)

        count = knowledge.get_knowledge_count_for_conversation(
            conversation_id=conversation_id,
            company_id=company_uuid
        )
        return {"count": count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/conversations/{conversation_id}/linked-project")
async def get_conversation_linked_project(
    conversation_id: str,
    company_id: str = Query(..., description="Company ID or slug"),
    user: dict = Depends(get_current_user)
):
    """Check if a conversation has a linked project."""
    try:
        from ..storage import get_supabase_service
        service_client = get_supabase_service()
        access_token = user.get("access_token")

        if service_client is None:
            return {"project": None}

        company_uuid = storage.resolve_company_id(company_id, access_token)

        project_result = service_client.table("projects") \
            .select("id, name, description, status, source_conversation_id") \
            .eq("company_id", company_uuid) \
            .eq("source_conversation_id", conversation_id) \
            .limit(1) \
            .execute()

        if project_result.data and project_result.data[0]:
            return {"project": project_result.data[0]}

        ke_result = service_client.table("knowledge_entries") \
            .select("project_id") \
            .eq("company_id", company_uuid) \
            .eq("source_conversation_id", conversation_id) \
            .eq("is_active", True) \
            .not_.is_("project_id", "null") \
            .limit(1) \
            .execute()

        if not ke_result.data or not ke_result.data[0].get("project_id"):
            return {"project": None}

        project_id = ke_result.data[0]["project_id"]

        project_result = service_client.table("projects") \
            .select("id, name, description, status") \
            .eq("id", project_id) \
            .single() \
            .execute()

        if not project_result.data:
            return {"project": None}

        return {"project": project_result.data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/conversations/{conversation_id}/decision")
async def get_conversation_decision(
    conversation_id: str,
    company_id: str = Query(..., description="Company ID or slug"),
    response_index: int = Query(..., description="Index of the response within the conversation"),
    user: dict = Depends(get_current_user)
):
    """Check if a specific decision exists for this conversation and response index."""
    try:
        from ..storage import get_supabase_service
        service_client = get_supabase_service()
        access_token = user.get("access_token")

        if service_client is None:
            return {"decision": None}

        try:
            company_uuid = storage.resolve_company_id(company_id, access_token)
        except Exception:
            return {"decision": None}

        try:
            result = service_client.table("knowledge_entries") \
                .select("id, title, project_id, department_ids, created_at, response_index") \
                .eq("company_id", company_uuid) \
                .eq("source_conversation_id", conversation_id) \
                .eq("response_index", response_index) \
                .eq("is_active", True) \
                .limit(1) \
                .execute()
        except Exception:
            return {"decision": None}

        if result.data and result.data[0]:
            return {"decision": result.data[0]}

        # Legacy fallback
        if response_index == 1:
            try:
                legacy_result = service_client.table("knowledge_entries") \
                    .select("id, title, project_id, department_ids, created_at, response_index") \
                    .eq("company_id", company_uuid) \
                    .eq("source_conversation_id", conversation_id) \
                    .is_("response_index", "null") \
                    .eq("is_active", True) \
                    .order("created_at", desc=False) \
                    .limit(1) \
                    .execute()

                if legacy_result.data and legacy_result.data[0]:
                    return {"decision": legacy_result.data[0]}
            except Exception:
                pass

        return {"decision": None}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.patch("/knowledge/{entry_id}")
async def update_knowledge_entry(
    entry_id: str,
    request: UpdateKnowledgeRequest,
    user: dict = Depends(get_current_user)
):
    """Update a knowledge entry."""
    validate_uuid(entry_id, "entry_id")
    try:
        result = knowledge.update_knowledge_entry(
            entry_id=entry_id,
            user_id=user["id"],
            updates=request.model_dump(exclude_unset=True),
            access_token=user.get("access_token")
        )
        if result:
            return result
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.delete("/knowledge/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    user: dict = Depends(get_current_user)
):
    """Soft delete a knowledge entry."""
    validate_uuid(entry_id, "entry_id")
    try:
        success = knowledge.deactivate_knowledge_entry(
            entry_id=entry_id,
            user_id=user["id"],
            access_token=user.get("access_token")
        )
        if success:
            return {"success": True}
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


# =============================================================================
# AI-ASSISTED EXTRACTION
# =============================================================================

@router.post("/knowledge/extract")
@limiter.limit("10/minute;50/hour")
async def extract_decision_from_response(
    request: Request,
    extract_request: ExtractDecisionRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to extract the key decision/recommendation from a council response.
    Returns structured data: title, problem_statement, decision_text, reasoning, category, department.
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..knowledge_fallback import extract_knowledge_fallback

    summarizer_model = await model_registry.get_primary_model('decision_summarizer') or 'anthropic/claude-3-5-haiku-20241022'

    if MOCK_LLM:
        return {
            "success": True,
            "extracted": {
                "title": "Persistent Context Storage Implementation",
                "problem_statement": "The team needed a reliable way to store AI context and decisions.",
                "decision_text": "Implement a Supabase-based context storage system.",
                "reasoning": "Supabase already handles authentication - no new systems needed.",
                "category": "technical_decision",
                "department": "technology",
                "used_ai": True
            }
        }

    user_question = extract_request.user_question[:3000] if extract_request.user_question else ""
    council_response = extract_request.council_response[:5000] if extract_request.council_response else ""

    extraction_prompt = f"""Extract and REWRITE the key decision into SHORT, CLEAN business language.

QUESTION: {user_question}

RESPONSE: {council_response}

---

EXTRACT these 7 fields (keep each field SHORT and CLEAN):

1. CONTEXT_SUMMARY: A clean 1-2 sentence summary of what was asked.
2. TITLE: 5-8 words describing the DECISION (not the question)
3. PROBLEM_STATEMENT: What problem was being solved? (2-4 bullet points)
4. DECISION_TEXT: What was decided? The actual recommendation. (2-4 bullet points)
5. REASONING: Why this approach? (2-3 bullet points)
6. CATEGORY: ONE of: technical_decision, ux_pattern, feature, policy, process, general
7. DEPARTMENT: ONE of: technology, ux, marketing, operations, strategy, finance, hr, general

RESPOND WITH JSON ONLY:
{{
  "context_summary": "Clean 1-2 sentence summary of the question...",
  "title": "Short Decision Title",
  "problem_statement": "• Point 1\\n• Point 2",
  "decision_text": "• Decision 1\\n• Decision 2",
  "reasoning": "• Reason 1\\n• Reason 2",
  "category": "category_id",
  "department": "department_id"
}}

RULES:
- REWRITE in your own words - do NOT copy text verbatim
- context_summary should be professional prose, NOT bullet points
- Other fields: 50-150 characters max, use bullet points (•)
- NO markdown headers (##), NO asterisks (*), NO code
- CRITICAL: decision_text and reasoning MUST be DIFFERENT content"""

    try:
        messages = [
            {"role": "system", "content": "You are a business analyst extracting key decisions. Always respond with valid JSON."},
            {"role": "user", "content": extraction_prompt}
        ]

        result = await query_model(
            model=summarizer_model,
            messages=messages
        )

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
                fallback = extract_knowledge_fallback(extract_request.user_question, extract_request.council_response)
                return {"success": True, "extracted": fallback}
        else:
            fallback = extract_knowledge_fallback(extract_request.user_question, extract_request.council_response)
            return {"success": True, "extracted": fallback}

    except Exception:
        fallback = extract_knowledge_fallback(extract_request.user_question, extract_request.council_response)
        return {"success": True, "extracted": fallback}
