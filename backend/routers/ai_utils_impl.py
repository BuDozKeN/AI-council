"""
Helper functions for AI write assist - extracted from ai_utils.py to reduce complexity.

These functions support the ai_write_assist endpoint by handling:
- Mock responses
- Prompt preprocessing
- Persona fetching
- Title extraction
- Response formatting
"""

import re
import json
import logging
from typing import Dict, Any, Optional, Tuple, List
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def _generate_mock_response(context: str, playbook_type: Optional[str]) -> Dict[str, str]:
    """
    Generate a mock response for testing without calling LLM.

    Args:
        context: Write assist context (e.g., "playbook-content")
        playbook_type: Type of playbook (sop, framework, policy) if applicable

    Returns:
        Dict with 'suggestion' and optionally 'title'
    """
    response = {
        "suggestion": f"[AI Suggestion for {context}]\n\nThis is a mock response."
    }
    if playbook_type:
        response["title"] = f"Mock {playbook_type.title()} Title"
    return response


def _preprocess_prompt(prompt: str, context: str, playbook_type: Optional[str]) -> str:
    """
    Preprocess user prompt based on context.

    For playbook content, extracts just the user's description, stripping frontend's
    generic instructions.

    Args:
        prompt: Raw prompt from frontend
        context: Write assist context
        playbook_type: Type of playbook if applicable

    Returns:
        Preprocessed prompt ready for LLM
    """
    # Truncate to safe length
    prompt = prompt[:10000] if prompt else ""

    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # For playbook content, extract just the user's actual input
    is_playbook = context == "playbook-content" and playbook_type
    if is_playbook and "User input:" in prompt:
        user_input = prompt.split("User input:", 1)[-1].strip()
        return f"Create a {playbook_type} document based on this description:\n\n{user_input}"

    return prompt


def _build_write_assist_system_prompt(
    persona_prompt: str,
    context: str,
    playbook_type: Optional[str]
) -> str:
    """
    Build system prompt for write assist based on context.

    Args:
        persona_prompt: Base persona prompt from database
        context: Write assist context
        playbook_type: Type of playbook if applicable

    Returns:
        Complete system prompt for LLM
    """
    from ..personas import build_system_prompt

    is_playbook = context == "playbook-content" and playbook_type

    if is_playbook:
        # For playbooks, use persona as-is (no conflicting format instructions)
        return persona_prompt
    else:
        # For other contexts, add formatting guidelines
        system_prompt = build_system_prompt(persona_prompt, include_formatting=True)
        system_prompt += "\n\nFollow the specific instructions in the user's prompt exactly.\nReturn ONLY the improved/generated text - no explanations or meta-commentary."
        return system_prompt


def _extract_title_from_playbook(content: str) -> Optional[str]:
    """
    Extract title from generated playbook content using multiple regex patterns.

    Tries multiple patterns in order:
    1. **Name**: Something
    2. # Title (markdown heading)
    3. ## Name: Title
    4. TITLE: Something
    5. First bold text (if standalone)

    Args:
        content: Raw playbook content from LLM

    Returns:
        Extracted title or None if not found
    """
    lines = content.split('\n')

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Pattern 1: **Name**: Something (with optional leading number like "1. ")
        name_match = re.match(
            r'^(?:\d+\.\s*)?[\*#]*\s*\*?\*?Name\*?\*?:?\s*(.+)',
            line_stripped,
            re.IGNORECASE
        )
        if name_match:
            return name_match.group(1).strip()

        # Pattern 2: # Title, ## Title, or ### Title (markdown headings)
        heading_match = re.match(r'^#{1,3}\s+(.+)$', line_stripped)
        if heading_match:
            potential_title = heading_match.group(1).strip()
            # Skip generic section headers
            skip_titles = [
                'overview', 'introduction', 'purpose', 'summary', 'background',
                'the problem it solves', 'core dimensions', 'how to use it',
                'when not to use it', 'related frameworks', 'categories'
            ]
            if potential_title.lower() not in skip_titles:
                return potential_title

        # Pattern 3: ## Name: Title or **Name:** Title
        h2_name_match = re.match(
            r'^(?:##\s*)?(?:\*\*)?Name(?:\*\*)?:?\s*(.+)$',
            line_stripped,
            re.IGNORECASE
        )
        if h2_name_match:
            return h2_name_match.group(1).strip()

        # Pattern 4: TITLE: Something or Title: Something (case-insensitive)
        title_match = re.match(
            r'^(?:TITLE|Title|Framework|Framework Name):?\s*(.+)$',
            line_stripped,
            re.IGNORECASE
        )
        if title_match:
            return title_match.group(1).strip()

        # Pattern 5: First bold text (if line is just bold text)
        bold_only = re.match(r'^\*\*(.+)\*\*$', line_stripped)
        if bold_only:
            title = bold_only.group(1).strip()
            # Only use if it's not a generic section header
            if title.lower() not in ['name', 'overview', 'purpose', 'introduction', 'summary']:
                return title

    return None


def _clean_title(title: str) -> str:
    """
    Clean extracted title by removing quotes and markdown formatting.

    Args:
        title: Raw extracted title

    Returns:
        Cleaned title string
    """
    title = title.replace('"', '').replace("'", "").strip()
    title = re.sub(r'\*\*(.+)\*\*', r'\1', title)
    return title


def _strip_title_from_content(content: str, title: str) -> str:
    """
    Remove title heading from content if it appears at the start.

    This prevents duplication since title is shown separately in the UI.

    Args:
        content: Full playbook content
        title: Extracted title

    Returns:
        Content with title heading removed
    """
    lines = content.split('\n')
    if not lines:
        return content

    first_line = lines[0].strip()

    # Check if first line contains the title
    if first_line and (
        title.lower() in first_line.lower() or
        first_line.lstrip('#').strip().lower() == title.lower()
    ):
        # Remove the title line and any immediate blank lines
        remaining_lines = lines[1:]
        while remaining_lines and not remaining_lines[0].strip():
            remaining_lines = remaining_lines[1:]
        return '\n'.join(remaining_lines)

    return content


def _parse_playbook_response(raw_content: str) -> Tuple[str, Optional[str]]:
    """
    Parse LLM response for playbook content, extracting title and content.

    Args:
        raw_content: Raw response from LLM

    Returns:
        Tuple of (content, title)
    """
    # Extract title
    title = _extract_title_from_playbook(raw_content)

    if title:
        # Clean title
        title = _clean_title(title)
        logger.info(f"[AI Write Assist] Extracted title: {title}")

        # Strip title from content
        content = _strip_title_from_content(raw_content, title)
    else:
        logger.warning("[AI Write Assist] No title found in response")
        content = raw_content

    return content.strip(), title


def _format_playbook_response(content: str, title: Optional[str]) -> Dict[str, str]:
    """
    Format playbook response with content and title.

    Args:
        content: Processed content
        title: Extracted title (optional)

    Returns:
        Response dict with 'suggestion' and optionally 'title'
    """
    response = {"suggestion": content}
    if title:
        response["title"] = title
    return response


def _format_non_playbook_response(raw_content: str) -> Dict[str, str]:
    """
    Format non-playbook response by stripping markdown formatting.

    Args:
        raw_content: Raw response from LLM

    Returns:
        Response dict with cleaned 'suggestion'
    """
    # Remove markdown formatting
    suggestion = raw_content.replace('**', '').replace('__', '')
    suggestion = suggestion.replace('```', '').replace('`', '')
    return {"suggestion": suggestion}


async def _track_write_assist_usage(
    company_id: Optional[str],
    context: str,
    playbook_type: Optional[str],
    model: str,
    usage: Dict[str, Any]
) -> None:
    """
    Track LLM usage for write assist operation.

    Args:
        company_id: Company ID for tracking
        context: Write assist context
        playbook_type: Type of playbook if applicable
        model: Model used
        usage: Usage data from LLM response
    """
    if not company_id or not usage:
        return

    try:
        from .company.utils import save_internal_llm_usage

        # Determine operation type
        is_playbook = context == "playbook-content" and playbook_type
        if is_playbook:
            operation_type = f'write_assist_{playbook_type}'
        elif context:
            operation_type = f'write_assist_{context.replace("-", "_")}'
        else:
            operation_type = 'write_assist'

        await save_internal_llm_usage(
            company_id=company_id,
            operation_type=operation_type,
            model=model,
            usage=usage
        )
    except Exception as e:
        logger.debug("Failed to track write assist LLM usage: %s", e)
