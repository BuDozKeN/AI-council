"""
Clean data access helpers - single source of truth.

These helpers eliminate fallback chains and provide consistent access
to database fields after the schema cleanup migration.

Usage:
    from utils.models import get_content, get_department_ids, is_promoted

    content = get_content(entry)  # No more: body_md if body_md else summary
    depts = get_department_ids(entry)  # No more: department_ids or [department_id]
    promoted = is_promoted(entry)  # No more: checking is_promoted boolean
"""

from typing import Dict, Any, List, Optional


def get_content(record: Dict[str, Any]) -> str:
    """
    Get the content from a knowledge entry.

    After migration, this is simply the 'content' field.
    No fallback chain needed.

    Args:
        record: A knowledge_entries row as dict

    Returns:
        The content string, or empty string if not present
    """
    return record.get("content") or ""


def get_department_ids(record: Dict[str, Any]) -> List[str]:
    """
    Get department IDs from a record.

    After migration, this is simply the 'department_ids' array field.
    No fallback to singular department_id needed.

    Args:
        record: A knowledge_entries or projects row as dict

    Returns:
        List of department UUID strings, or empty list
    """
    return record.get("department_ids") or []


def is_promoted(record: Dict[str, Any]) -> bool:
    """
    Check if a decision has been promoted.

    Derived from promoted_to_id presence - no separate boolean field needed.
    A decision is promoted if it has either:
    - promoted_to_id (promoted to a playbook/SOP/framework/policy)
    - project_id (promoted to a project)

    Args:
        record: A knowledge_entries row as dict

    Returns:
        True if the decision has been promoted, False otherwise
    """
    return bool(record.get("promoted_to_id") or record.get("project_id"))


def get_question(record: Dict[str, Any]) -> str:
    """
    Get the user's original question from a knowledge entry.

    After migration, this is simply the 'question' field.

    Args:
        record: A knowledge_entries row as dict

    Returns:
        The question string, or empty string if not present
    """
    return record.get("question") or ""


def format_decision_response(
    entry: Dict[str, Any],
    department_map: Optional[Dict[str, Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Format a knowledge_entries record for API response.

    Single place for all decision formatting logic.

    Args:
        entry: A knowledge_entries row as dict
        department_map: Optional dict of department_id -> department data

    Returns:
        Formatted decision dict ready for API response
    """
    dept_ids = get_department_ids(entry)
    dept_names = []

    if department_map:
        for dept_id in dept_ids:
            dept = department_map.get(dept_id)
            if dept:
                dept_names.append(dept.get("name", ""))

    return {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": get_content(entry),
        "content_summary": entry.get("content_summary"),
        "question": get_question(entry),
        "question_summary": entry.get("question_summary"),
        "category": entry.get("category"),
        "tags": entry.get("tags") or [],
        "department_ids": dept_ids,
        "department_names": dept_names,
        "project_id": entry.get("project_id"),
        "is_promoted": is_promoted(entry),
        "promoted_to_id": entry.get("promoted_to_id"),
        "promoted_to_type": entry.get("promoted_to_type"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "response_index": entry.get("response_index"),
        "council_type": entry.get("council_type"),
        "scope": entry.get("scope") or "department",
        "auto_inject": entry.get("auto_inject") or False,
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
    }


def format_activity_response(log: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format an activity_logs record for API response.

    No title parsing needed - action is explicit from the database.

    Args:
        log: An activity_logs row as dict

    Returns:
        Formatted activity log dict ready for API response
    """
    return {
        "id": log.get("id"),
        "action": log.get("action"),
        "event_type": log.get("event_type"),
        "title": log.get("title"),
        "description": log.get("description"),
        "department_id": log.get("department_id"),
        "related_id": log.get("related_id"),
        "related_type": log.get("related_type"),
        "promoted_to_type": log.get("promoted_to_type"),
        "conversation_id": log.get("conversation_id"),
        "message_id": log.get("message_id"),
        "created_at": log.get("created_at"),
    }
