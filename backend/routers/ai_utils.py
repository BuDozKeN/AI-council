"""
AI Utilities Router

Endpoints for AI-assisted utilities:
- Text polishing (markdown conversion, field improvement)
- Write assist for form content
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
import json

from ..auth import get_current_user
from ..security import SecureHTTPException
from .. import model_registry
from ..database import get_supabase_service

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


async def _get_user_company_id(user: dict) -> Optional[str]:
    """
    Get the user's primary company ID for usage tracking.
    Returns None if user has no company (usage won't be tracked).
    """
    user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
    if not user_id:
        return None

    try:
        client = get_supabase_service()
        result = client.table("companies") \
            .select("id") \
            .eq("user_id", user_id) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
        return None
    except Exception:
        return None


router = APIRouter(prefix="", tags=["ai-utils"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class PolishTextRequest(BaseModel):
    """Request to polish/rewrite text using AI."""
    text: str
    field_type: str  # e.g., "client_background", "goals", "constraints", "additional", "markdown"


class AIWriteAssistRequest(BaseModel):
    """Request for AI writing assistance."""
    prompt: str = Field(..., max_length=50000)
    context: str = Field("generic", max_length=50)
    playbook_type: Optional[str] = Field(None, max_length=50)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/utils/polish-text")
async def polish_text(request: PolishTextRequest, user: dict = Depends(get_current_user)):
    """
    Use AI to polish/rewrite user-provided text for clarity and structure.
    """
    from ..openrouter import query_model
    from .company.utils import save_internal_llm_usage

    polish_model = await model_registry.get_primary_model('ai_polish') or 'google/gemini-3-pro-preview'

    # Get user's company for usage tracking
    company_id = await _get_user_company_id(user)

    # Special handling for markdown conversion
    if request.field_type == "markdown":
        prompt = f"""You are a markdown formatting expert. Convert the following text into clean, well-structured Markdown.

RULES:
1. Preserve ALL information - don't remove or summarize anything
2. Use proper Markdown syntax:
   - # for main title, ## for sections, ### for subsections
   - | col | col | for tables (with header separator |---|---|)
   - ```language for code blocks (detect language: javascript, css, python, etc.)
   - **bold** for emphasis
   - - for bullet lists
   - 1. for numbered lists
3. If you see tabular data (columns of values), convert to proper Markdown tables
4. If you see code (CSS properties, JavaScript, functions), wrap in code blocks
5. Detect numbered sections like "1. Title" and convert to ## headers
6. Output ONLY the formatted markdown, no explanations

TEXT TO CONVERT:
{request.text}

MARKDOWN:"""

        try:
            messages = [
                {"role": "system", "content": "You are a markdown formatting expert. Convert text to clean, properly structured Markdown."},
                {"role": "user", "content": prompt}
            ]

            result = await query_model(
                model=polish_model,
                messages=messages
            )

            # Track usage
            if company_id and result and result.get('usage'):
                try:
                    await save_internal_llm_usage(
                        company_id=company_id,
                        operation_type='text_polish_markdown',
                        model=polish_model,
                        usage=result['usage']
                    )
                except Exception:
                    pass  # Don't fail the request if tracking fails

            if result and result.get('content'):
                return {"polished": result['content'].strip()}
            else:
                raise HTTPException(status_code=500, detail="Failed to get AI response")
        except Exception as e:
            raise SecureHTTPException.internal_error(f"AI polish failed: {str(e)}")

    # Field-specific prompts
    field_prompts = {
        "client_background": "This text describes a client or project. Rewrite it clearly, organizing information about the company, industry, size, and key people.",
        "goals": "This text describes goals and objectives. Rewrite it as clear, actionable bullet points or short paragraphs.",
        "constraints": "This text describes constraints and requirements. Rewrite it clearly, organizing budget, timeline, technical, and other constraints.",
        "additional": "This is additional context for an AI advisor. Rewrite it clearly and concisely."
    }

    field_context = field_prompts.get(request.field_type, "Rewrite this text clearly and concisely.")

    prompt = f"""You are a helpful writing assistant. The user has written some rough notes and wants you to polish them into clear, well-structured text.

{field_context}

IMPORTANT:
- Keep the same information - don't add or invent details
- Make it clear and easy to read
- Use bullet points if there are multiple items
- Keep it concise but complete
- Don't use markdown headers (##) - just plain text and bullet points
- Output ONLY the polished text, nothing else

User's rough text:
{request.text}

Polished version:"""

    try:
        messages = [
            {"role": "system", "content": "You are a helpful writing assistant that polishes rough notes into clear, well-structured text."},
            {"role": "user", "content": prompt}
        ]

        result = await query_model(
            model=polish_model,
            messages=messages
        )

        # Track usage
        if company_id and result and result.get('usage'):
            try:
                await save_internal_llm_usage(
                    company_id=company_id,
                    operation_type='text_polish',
                    model=polish_model,
                    usage=result['usage']
                )
            except Exception:
                pass  # Don't fail the request if tracking fails

        if result and result.get('content'):
            return {"polished": result['content'].strip()}
        else:
            raise HTTPException(status_code=500, detail="Failed to get AI response")
    except Exception as e:
        raise SecureHTTPException.internal_error(f"AI polish failed: {str(e)}")


@router.post("/ai/write-assist")
@limiter.limit("15/minute;100/hour")
async def ai_write_assist(
    request: Request,
    write_request: AIWriteAssistRequest,
    user: dict = Depends(get_current_user)
):
    """
    AI Writing Assistant - helps users write better form content.

    For playbook types (sop, framework, policy), fetches persona from database.
    Returns both content suggestion and a generated title for playbooks.

    Refactored to use helper functions for better maintainability.
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_write_assist_persona_async, PersonaNotFoundError
    from .ai_utils_refactored import (
        _generate_mock_response,
        _preprocess_prompt,
        _build_write_assist_system_prompt,
        _parse_playbook_response,
        _format_playbook_response,
        _format_non_playbook_response,
        _track_write_assist_usage
    )
    import logging

    logging.info(f"[AI Write Assist] Request: context={write_request.context}, playbook_type={write_request.playbook_type}")

    # 1. Get user's company for usage tracking
    company_id = await _get_user_company_id(user)

    # 2. Handle mock mode
    if MOCK_LLM:
        return _generate_mock_response(write_request.context, write_request.playbook_type)

    # 3. Preprocess prompt
    prompt = _preprocess_prompt(
        write_request.prompt,
        write_request.context,
        write_request.playbook_type
    )

    # 4. Fetch persona from database
    try:
        persona_data = await get_write_assist_persona_async(
            write_request.context,
            write_request.playbook_type
        )
    except PersonaNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI persona unavailable: {str(e)}"
        )

    # 5. Parse model preferences
    persona_prompt = persona_data["system_prompt"]
    model_preferences = persona_data["model_preferences"]
    if isinstance(model_preferences, str):
        model_preferences = json.loads(model_preferences)

    # 6. Build system prompt
    system_prompt = _build_write_assist_system_prompt(
        persona_prompt,
        write_request.context,
        write_request.playbook_type
    )

    # 7. Query LLM with model fallback
    is_playbook = write_request.context == "playbook-content" and write_request.playbook_type
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]

    try:
        for model_to_use in model_preferences:
            try:
                result = await query_model(model=model_to_use, messages=messages)

                if result and result.get('content'):
                    raw_content = result['content'].strip()

                    # 8. Track usage
                    await _track_write_assist_usage(
                        company_id,
                        write_request.context,
                        write_request.playbook_type,
                        model_to_use,
                        result.get('usage', {})
                    )

                    # 9. Format response based on context
                    if is_playbook:
                        content, title = _parse_playbook_response(raw_content)
                        return _format_playbook_response(content, title)
                    else:
                        return _format_non_playbook_response(raw_content)

            except Exception:
                continue  # Try next model

        raise SecureHTTPException.internal_error("All AI models failed")

    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(f"AI assistance failed: {str(e)}")
