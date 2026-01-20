"""
Refactored projects.py helpers - Breaking down the F-grade merge_decision_into_project function.

This module extracts helper functions to reduce cyclomatic complexity from F (46) to manageable levels.
"""

import json
import re
from typing import Optional, Dict, Any, List, Tuple


def _extract_json_from_llm_response(content: str) -> Optional[Dict[str, Any]]:
    """
    Extract JSON from LLM response, handling markdown code blocks.

    Args:
        content: Raw LLM response content

    Returns:
        Parsed JSON dict or None if parsing fails
    """
    # Try to find JSON in markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
    if json_match:
        content = json_match.group(1).strip()
    else:
        # Try to find raw JSON object
        json_obj_match = re.search(r'\{[\s\S]*?\}', content)
        if json_obj_match:
            content = json_obj_match.group(0)
        else:
            content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def _generate_decision_title(question: Optional[str], default: str = "Council Decision") -> str:
    """
    Generate a decision title from the question or use default.

    Args:
        question: User's question
        default: Default title if no question

    Returns:
        Decision title string
    """
    if not question:
        return default

    if len(question) > 50:
        return f"Decision: {question[:50]}..."
    else:
        return f"Decision: {question}"


def _normalize_department_ids(
    department_ids: Optional[List[str]],
    department_id: Optional[str]
) -> List[str]:
    """
    Normalize department IDs to a list, handling legacy single-value and "all" special case.

    Args:
        department_ids: List of department IDs
        department_id: Single department ID (legacy)

    Returns:
        List of department IDs
    """
    if department_ids:
        return department_ids

    if department_id and department_id != "all":
        return [department_id]

    return []


async def _save_decision_to_knowledge(
    client,
    company_uuid: str,
    project_id: str,
    decision_title: str,
    decision_content: str,
    question: Optional[str],
    dept_ids: List[str],
    conversation_id: Optional[str],
    response_index: Optional[int],
    user_id: str
) -> Optional[str]:
    """
    Save decision to knowledge_entries table.

    Args:
        client: Supabase client
        company_uuid: Company UUID
        project_id: Project UUID
        decision_title: Title for the decision
        decision_content: Full decision content
        question: User's question
        dept_ids: List of department IDs
        conversation_id: Source conversation ID
        response_index: Response index in conversation
        user_id: User ID who created the decision

    Returns:
        Saved decision ID or None if save failed
    """
    insert_data = {
        "company_id": company_uuid,
        "title": decision_title,
        "content": decision_content,
        "question": question,
        "scope": "project",
        "department_ids": dept_ids if dept_ids else [],
        "project_id": project_id,
        "source_conversation_id": conversation_id if conversation_id and not conversation_id.startswith("temp-") else None,
        "response_index": response_index,
        "auto_inject": False,
        "category": "technical_decision",
        "is_active": True,
        "created_by": user_id,
        "tags": []
    }

    try:
        result = client.table("knowledge_entries").insert(insert_data).execute()
        if result.data and len(result.data) > 0:
            return result.data[0].get("id")
    except Exception:
        raise

    return None


def _sync_departments_to_project(client, project_id: str, dept_ids: List[str]) -> None:
    """
    Sync department IDs to project, merging with existing departments.

    Args:
        client: Supabase client
        project_id: Project UUID
        dept_ids: Department IDs to add
    """
    if not dept_ids:
        return

    try:
        project_result = client.table("projects").select("department_ids").eq("id", project_id).single().execute()
        if not project_result.data:
            return

        current_dept_ids = set(project_result.data.get("department_ids") or [])
        new_dept_ids = set(dept_ids)

        if not new_dept_ids.issubset(current_dept_ids):
            updated_dept_ids = list(current_dept_ids | new_dept_ids)
            client.table("projects").update({"department_ids": updated_dept_ids}).eq("id", project_id).execute()
    except Exception:
        pass  # Non-critical - don't fail if sync fails


async def _track_merge_llm_usage(
    company_id: Optional[str],
    project_id: str,
    model: str,
    usage: Dict[str, Any]
) -> None:
    """
    Track internal LLM usage for decision merge operation.

    Args:
        company_id: Company ID
        project_id: Project ID
        model: Model name
        usage: Usage stats from LLM response
    """
    if not company_id or not usage:
        return

    try:
        from .company.utils import save_internal_llm_usage
        await save_internal_llm_usage(
            company_id=company_id,
            operation_type='decision_merge',
            model=model,
            usage=usage,
            related_id=project_id
        )
    except Exception:
        pass  # Don't fail merge if tracking fails


def _trigger_summary_generation(decision_id: str, company_uuid: str) -> None:
    """
    Fire-and-forget: trigger background summary generation for decision.

    Args:
        decision_id: Decision ID
        company_uuid: Company UUID
    """
    try:
        import asyncio
        from .company import generate_decision_summary_internal
        asyncio.create_task(generate_decision_summary_internal(decision_id, company_uuid))
    except Exception:
        pass  # Non-critical background task
