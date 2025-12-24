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
from ..model_registry import model_registry

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/api", tags=["ai-utils"])


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

    polish_model = await model_registry.get_primary_model('ai_polish') or 'google/gemini-3-pro-preview'

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
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_write_assist_persona_async, build_system_prompt

    if MOCK_LLM:
        return {
            "suggestion": f"[AI Suggestion for {write_request.context}]\n\nThis is a mock response."
        }

    prompt = write_request.prompt[:10000] if write_request.prompt else ""
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    persona_data = await get_write_assist_persona_async(write_request.context, write_request.playbook_type)
    persona_prompt = persona_data["system_prompt"]
    model_preferences = persona_data["model_preferences"]

    if isinstance(model_preferences, str):
        model_preferences = json.loads(model_preferences)

    system_prompt = build_system_prompt(persona_prompt, include_formatting=True)
    system_prompt += "\n\nFollow the specific instructions in the user's prompt exactly.\nReturn ONLY the improved/generated text - no explanations or meta-commentary."

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        for model_to_use in model_preferences:
            try:
                result = await query_model(
                    model=model_to_use,
                    messages=messages
                )

                if result and result.get('content'):
                    suggestion = result['content'].strip()
                    suggestion = suggestion.replace('**', '').replace('__', '')
                    suggestion = suggestion.replace('```', '').replace('`', '')
                    return {"suggestion": suggestion}
                else:
                    continue

            except Exception:
                continue

        raise SecureHTTPException.internal_error("All AI models failed")

    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(f"AI assistance failed: {str(e)}")
