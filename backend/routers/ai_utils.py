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
    """
    from ..openrouter import query_model, MOCK_LLM
    from ..personas import get_write_assist_persona_async, build_system_prompt, PersonaNotFoundError
    from .company.utils import save_internal_llm_usage
    import logging

    logging.info(f"[AI Write Assist] Request: context={write_request.context}, playbook_type={write_request.playbook_type}")

    # Get user's company for usage tracking
    company_id = await _get_user_company_id(user)

    if MOCK_LLM:
        response = {
            "suggestion": f"[AI Suggestion for {write_request.context}]\n\nThis is a mock response."
        }
        if write_request.playbook_type:
            response["title"] = f"Mock {write_request.playbook_type.title()} Title"
        return response

    prompt = write_request.prompt[:10000] if write_request.prompt else ""
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # For playbook content, extract just the user's description - strip frontend's generic instructions
    # The frontend sends: "Turn this into a step-by-step guide...\n\nUser input:\n[actual description]"
    # We want to extract just the actual description and use the DB persona's expertise instead
    is_playbook = write_request.context == "playbook-content" and write_request.playbook_type
    if is_playbook and "User input:" in prompt:
        # Extract just the user's actual input, ignore the generic frontend instruction
        user_input = prompt.split("User input:", 1)[-1].strip()
        prompt = f"Create a {write_request.playbook_type} document based on this description:\n\n{user_input}"

    # Get persona from database (raises error if not found for playbook types)
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

    persona_prompt = persona_data["system_prompt"]
    model_preferences = persona_data["model_preferences"]

    if isinstance(model_preferences, str):
        model_preferences = json.loads(model_preferences)

    # For playbook content, use the persona as-is (no conflicting format instructions)
    # We'll extract the title from the document structure (## Name, # Title, first heading, etc.)
    if is_playbook:
        system_prompt = persona_prompt
    else:
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
                    raw_content = result['content'].strip()

                    # Track usage - determine operation type based on context
                    if company_id and result.get('usage'):
                        try:
                            operation_type = 'write_assist'
                            if is_playbook:
                                operation_type = f'write_assist_{write_request.playbook_type}'  # e.g., write_assist_framework
                            elif write_request.context:
                                operation_type = f'write_assist_{write_request.context.replace("-", "_")}'
                            await save_internal_llm_usage(
                                company_id=company_id,
                                operation_type=operation_type,
                                model=model_to_use,
                                usage=result['usage']
                            )
                        except Exception:
                            pass  # Don't fail the request if tracking fails

                    # Parse title and content for playbooks
                    if is_playbook:
                        import re

                        title = None
                        content = raw_content

                        # Extract title from document structure
                        lines = raw_content.split('\n')

                        for line in lines:
                            line_stripped = line.strip()
                            if not line_stripped:
                                continue

                            # Pattern 1: **Name**: Something (with optional leading number like "1. ")
                            name_match = re.match(r'^(?:\d+\.\s*)?[\*#]*\s*\*?\*?Name\*?\*?:?\s*(.+)', line_stripped, re.IGNORECASE)
                            if name_match:
                                title = name_match.group(1).strip()
                                break

                            # Pattern 2: # Title, ## Title, or ### Title (markdown headings)
                            # The first heading in the document is likely the title
                            heading_match = re.match(r'^#{1,3}\s+(.+)$', line_stripped)
                            if heading_match:
                                potential_title = heading_match.group(1).strip()
                                # Skip generic section headers
                                skip_titles = ['overview', 'introduction', 'purpose', 'summary', 'background',
                                              'the problem it solves', 'core dimensions', 'how to use it',
                                              'when not to use it', 'related frameworks', 'categories']
                                if potential_title.lower() not in skip_titles:
                                    title = potential_title
                                    break

                            # Pattern 3: ## Name: Title or **Name:** Title
                            h2_name_match = re.match(r'^(?:##\s*)?(?:\*\*)?Name(?:\*\*)?:?\s*(.+)$', line_stripped, re.IGNORECASE)
                            if h2_name_match:
                                title = h2_name_match.group(1).strip()
                                break

                            # Pattern 4: TITLE: Something or Title: Something (case-insensitive)
                            title_match = re.match(r'^(?:TITLE|Title|Framework|Framework Name):?\s*(.+)$', line_stripped, re.IGNORECASE)
                            if title_match:
                                title = title_match.group(1).strip()
                                break

                            # Pattern 5: First bold text (if line is just bold text)
                            bold_only = re.match(r'^\*\*(.+)\*\*$', line_stripped)
                            if bold_only:
                                title = bold_only.group(1).strip()
                                # Only use if it's not a generic section header
                                if title.lower() not in ['name', 'overview', 'purpose', 'introduction', 'summary']:
                                    break

                        # Clean up title
                        if title:
                            title = title.replace('"', '').replace("'", "").strip()
                            title = re.sub(r'\*\*(.+)\*\*', r'\1', title)
                            logging.info(f"[AI Write Assist] Extracted title: {title}")
                        else:
                            logging.warning("[AI Write Assist] No title found in response")

                        # Strip the title heading from content if it's at the start
                        # This prevents duplication since title is shown separately in the UI
                        if title:
                            # Remove the first line if it's the title heading
                            first_line = lines[0].strip() if lines else ""
                            if first_line and (
                                title.lower() in first_line.lower() or
                                first_line.lstrip('#').strip().lower() == title.lower()
                            ):
                                # Remove the title line and any immediate blank lines
                                remaining_lines = lines[1:]
                                while remaining_lines and not remaining_lines[0].strip():
                                    remaining_lines = remaining_lines[1:]
                                content = '\n'.join(remaining_lines)

                        response = {"suggestion": content.strip()}
                        if title:
                            response["title"] = title
                        return response
                    else:
                        # Non-playbook: just return suggestion
                        suggestion = raw_content.replace('**', '').replace('__', '')
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
