"""
Refactored utils.py helpers - Breaking down the E-grade generate_decision_summary_internal function.

This module extracts helper functions to reduce cyclomatic complexity from E (44) to manageable levels.
"""

from typing import Dict, List, Optional, Tuple
import json
import logging

logger = logging.getLogger(__name__)


def _fetch_decision_data(service_client, decision_id: str, company_uuid: str) -> Optional[Dict]:
    """
    Fetch decision data from knowledge_entries table.

    Args:
        service_client: Supabase service client
        decision_id: Decision UUID
        company_uuid: Company UUID

    Returns:
        Decision data dict or None if not found
    """
    result = service_client.table("knowledge_entries") \
        .select("id, question, content, title, content_summary, source_conversation_id, response_index, created_at") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    return result.data if result.data else None


def _fetch_prior_context(
    service_client,
    conversation_id: Optional[str],
    response_index: int,
    company_uuid: str
) -> str:
    """
    Fetch prior decisions from the same conversation for context.

    Args:
        service_client: Supabase service client
        conversation_id: Source conversation ID
        response_index: Current response index
        company_uuid: Company UUID

    Returns:
        Formatted prior context string
    """
    if not conversation_id or response_index <= 0:
        return ""

    try:
        prior_result = service_client.table("knowledge_entries") \
            .select("question, content, content_summary, title, response_index") \
            .eq("source_conversation_id", conversation_id) \
            .eq("company_id", company_uuid) \
            .lt("response_index", response_index) \
            .order("response_index") \
            .execute()

        if not prior_result.data:
            return ""

        prior_items = []
        for prior in prior_result.data:
            idx = prior.get("response_index", 0) or 0
            prior_q = prior.get("question", "")
            prior_title = prior.get("title", "")
            prior_response = prior.get("content", "")
            prior_summary = prior.get("content_summary", "")

            item = f"### Decision #{idx + 1}: {prior_title}\n"
            item += f"**User asked:** {prior_q}\n"
            if prior_summary:
                item += f"**Summary:** {prior_summary}\n"
            elif prior_response:
                first_para = prior_response.split('\n\n')[0][:400]
                item += f"**Council decided:** {first_para}...\n"
            prior_items.append(item)

        return "\n\n".join(prior_items) if prior_items else ""

    except Exception as e:
        logger.warning("Failed to fetch prior decisions for summary: %s", e)
        return ""


def _generate_mock_summary(user_question: str, council_response: str) -> Dict:
    """
    Generate mock summary for MOCK_LLM mode.

    Args:
        user_question: User's question
        council_response: Council's response

    Returns:
        Mock summary dict
    """
    if user_question:
        mock_title = f"Decision about {user_question[:30]}..."
        mock_summary = f"The user asked about {user_question[:100]}..."
    else:
        mock_title = "Council Decision Summary"
        mock_summary = f"The council discussed: {council_response[:100]}..."

    return {"summary": mock_summary, "title": mock_title, "cached": False}


def _build_prompt(
    prior_context: str,
    user_question: str,
    council_excerpt: str,
    response_index: int,
    _build_followup_prompt,
    _build_legacy_prompt,
    _build_standard_prompt
) -> str:
    """
    Build appropriate prompt based on context.

    Args:
        prior_context: Prior decisions context
        user_question: User's question
        council_excerpt: Council response excerpt
        response_index: Response index in conversation
        _build_followup_prompt: Followup prompt builder function
        _build_legacy_prompt: Legacy prompt builder function
        _build_standard_prompt: Standard prompt builder function

    Returns:
        Formatted prompt string
    """
    if prior_context and response_index > 0:
        return _build_followup_prompt(prior_context, user_question, council_excerpt, response_index)
    elif not user_question:
        return _build_legacy_prompt(council_excerpt)
    else:
        return _build_standard_prompt(user_question, council_excerpt)


def _parse_llm_response(content: str, current_title: str) -> Tuple[str, str, str]:
    """
    Parse LLM response to extract title, question summary, and content summary.

    Args:
        content: Raw LLM response
        current_title: Current decision title (fallback)

    Returns:
        Tuple of (title, question_summary, summary)
    """
    generated_title = current_title
    generated_question_summary = ""
    generated_summary = ""

    if "TITLE:" in content:
        title_match = content.split("TITLE:")[1]

        if "QUESTION_SUMMARY:" in title_match:
            generated_title = title_match.split("QUESTION_SUMMARY:")[0].strip()
        elif "SUMMARY:" in title_match:
            generated_title = title_match.split("SUMMARY:")[0].strip()
        else:
            generated_title = title_match.split("\n")[0].strip()

        if "QUESTION_SUMMARY:" in content:
            qs_part = content.split("QUESTION_SUMMARY:")[1]
            if "SUMMARY:" in qs_part:
                generated_question_summary = qs_part.split("SUMMARY:")[0].strip()
            else:
                generated_question_summary = qs_part.split("\n")[0].strip()

        if "SUMMARY:" in content:
            parts = content.split("SUMMARY:")
            generated_summary = parts[-1].strip()
    else:
        generated_summary = content

    return generated_title, generated_question_summary, generated_summary


def _update_decision_with_summary(
    service_client,
    decision_id: str,
    generated_title: str,
    generated_summary: str,
    generated_question_summary: str,
    current_title: str
) -> Dict:
    """
    Update decision with generated summary data.

    Args:
        service_client: Supabase service client
        decision_id: Decision UUID
        generated_title: Generated title
        generated_summary: Generated summary
        generated_question_summary: Generated question summary
        current_title: Current title (for comparison)

    Returns:
        Result dict with summary data
    """
    if not generated_summary and not generated_question_summary:
        return None

    update_data = {"content_summary": generated_summary}

    if generated_title and generated_title != current_title:
        update_data["title"] = generated_title

    if generated_question_summary:
        update_data["question_summary"] = generated_question_summary

    service_client.table("knowledge_entries") \
        .update(update_data) \
        .eq("id", decision_id) \
        .execute()

    return {
        "summary": generated_summary,
        "title": generated_title,
        "question_summary": generated_question_summary,
        "cached": False
    }


def _get_fallback_summary(user_question: str, council_response: str, title: str) -> Dict:
    """
    Generate fallback summary when LLM fails.

    Args:
        user_question: User's question
        council_response: Council's response
        title: Decision title

    Returns:
        Fallback summary dict
    """
    fallback = user_question[:300] if user_question else (
        council_response[:300] if council_response else "No content available"
    )
    return {"summary": fallback, "title": title, "cached": False}


async def _track_summary_llm_usage(
    company_uuid: str,
    decision_id: str,
    model_used: str,
    response: Dict,
    save_internal_llm_usage
) -> None:
    """
    Track internal LLM usage for summary generation.

    Args:
        company_uuid: Company UUID
        decision_id: Decision ID
        model_used: Model used
        response: LLM response with usage data
        save_internal_llm_usage: Usage tracking function
    """
    if not company_uuid or not response or not response.get('usage'):
        return

    try:
        await save_internal_llm_usage(
            company_id=company_uuid,
            operation_type='decision_summary',
            model=model_used,
            usage=response['usage'],
            related_id=decision_id
        )
    except Exception as e:
        logger.debug("Failed to track LLM usage for decision_summary: %s", e)
