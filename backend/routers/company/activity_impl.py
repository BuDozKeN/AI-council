"""
Refactored activity.py helpers - Breaking down the E-grade get_activity_logs function.

This module extracts helper functions to reduce cyclomatic complexity from E (45) to manageable levels.
"""

from typing import Set, Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone


def _build_activity_query(client, company_uuid: str, fetch_limit: int, event_type: Optional[str], days: Optional[int]):
    """
    Build the base activity logs query with filters.

    Args:
        client: Supabase client
        company_uuid: Company UUID
        fetch_limit: Number of logs to fetch
        event_type: Optional event type filter
        days: Optional days filter

    Returns:
        Configured query object
    """
    query = client.table("activity_logs") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("created_at", desc=True) \
        .limit(fetch_limit)

    if event_type:
        query = query.eq("event_type", event_type)

    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = query.gte("created_at", cutoff)

    return query


def _collect_related_ids(logs: List[Dict]) -> Tuple[Set[str], Set[str], Set[str]]:
    """
    Collect all related IDs from logs grouped by type.

    Args:
        logs: List of activity log dictionaries

    Returns:
        Tuple of (decision_ids, playbook_ids, project_ids)
    """
    decision_ids = set()
    playbook_ids = set()
    project_ids = set()

    for log in logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")

        if related_id and related_type:
            if related_type == "decision":
                decision_ids.add(related_id)
            elif related_type == "playbook":
                playbook_ids.add(related_id)
            elif related_type == "project":
                project_ids.add(related_id)

    return decision_ids, playbook_ids, project_ids


def _batch_check_decisions(client, decision_ids: Set[str], log_error) -> Tuple[Set[str], Dict[str, str]]:
    """
    Batch check existence of decisions and get promoted types.

    Args:
        client: Supabase client
        decision_ids: Set of decision IDs to check
        log_error: Error logging function

    Returns:
        Tuple of (existing_decision_ids, decision_promoted_types)
    """
    if not decision_ids:
        return set(), {}

    existing_decisions = set()
    decision_promoted_types = {}

    try:
        result = client.table("knowledge_entries") \
            .select("id, promoted_to_type, project_id") \
            .in_("id", list(decision_ids)) \
            .eq("is_active", True) \
            .execute()

        for r in (result.data or []):
            existing_decisions.add(r["id"])
            # Set promoted_to_type - prefer stored value, fall back to 'project' if has project_id
            if r.get("promoted_to_type"):
                decision_promoted_types[r["id"]] = r["promoted_to_type"]
            elif r.get("project_id"):
                decision_promoted_types[r["id"]] = "project"

    except Exception as e:
        log_error(e, "activity.batch_check_decisions")
        existing_decisions = decision_ids  # Assume all exist on error

    return existing_decisions, decision_promoted_types


def _batch_check_playbooks(client, playbook_ids: Set[str], log_error) -> Set[str]:
    """
    Batch check existence of playbooks.

    Args:
        client: Supabase client
        playbook_ids: Set of playbook IDs to check
        log_error: Error logging function

    Returns:
        Set of existing playbook IDs
    """
    if not playbook_ids:
        return set()

    try:
        result = client.table("org_documents") \
            .select("id") \
            .in_("id", list(playbook_ids)) \
            .eq("is_active", True) \
            .execute()
        return {r["id"] for r in (result.data or [])}
    except Exception as e:
        log_error(e, "activity.batch_check_playbooks")
        return playbook_ids  # Assume all exist on error


def _batch_check_projects(client, project_ids: Set[str], log_error) -> Set[str]:
    """
    Batch check existence of projects.

    Args:
        client: Supabase client
        project_ids: Set of project IDs to check
        log_error: Error logging function

    Returns:
        Set of existing project IDs
    """
    if not project_ids:
        return set()

    try:
        result = client.table("projects") \
            .select("id") \
            .in_("id", list(project_ids)) \
            .execute()
        return {r["id"] for r in (result.data or [])}
    except Exception as e:
        log_error(e, "activity.batch_check_projects")
        return project_ids  # Assume all exist on error


def _check_log_validity(
    log: Dict,
    existing_decisions: Set[str],
    existing_playbooks: Set[str],
    existing_projects: Set[str],
    decision_promoted_types: Dict[str, str]
) -> Tuple[bool, Dict]:
    """
    Check if a log's related item exists and enrich with current state.

    Args:
        log: Activity log dictionary
        existing_decisions: Set of existing decision IDs
        existing_playbooks: Set of existing playbook IDs
        existing_projects: Set of existing project IDs
        decision_promoted_types: Map of decision ID to promoted type

    Returns:
        Tuple of (is_valid, enriched_log)
    """
    related_id = log.get("related_id")
    related_type = log.get("related_type")

    # Keep logs without related items (e.g., general events)
    if not related_id or not related_type:
        return True, log

    # Check if related item exists
    exists = False

    if related_type == "decision":
        exists = related_id in existing_decisions
        # Enrich with current promoted_to_type
        if exists and related_id in decision_promoted_types:
            log = {**log, "promoted_to_type": decision_promoted_types[related_id]}

    elif related_type == "playbook":
        exists = related_id in existing_playbooks

    elif related_type == "project":
        exists = related_id in existing_projects
        # For project-type activities, ensure promoted_to_type is set
        if exists and not log.get("promoted_to_type"):
            log = {**log, "promoted_to_type": "project"}

    return exists, log


def _filter_and_enrich_logs(
    all_logs: List[Dict],
    existing_decisions: Set[str],
    existing_playbooks: Set[str],
    existing_projects: Set[str],
    decision_promoted_types: Dict[str, str]
) -> Tuple[List[Dict], List[str]]:
    """
    Filter out orphaned logs and enrich with current state.

    Args:
        all_logs: All fetched logs
        existing_decisions: Set of existing decision IDs
        existing_playbooks: Set of existing playbook IDs
        existing_projects: Set of existing project IDs
        decision_promoted_types: Map of decision ID to promoted type

    Returns:
        Tuple of (valid_logs, orphaned_log_ids)
    """
    valid_logs = []
    orphaned_ids = []

    for log in all_logs:
        is_valid, enriched_log = _check_log_validity(
            log,
            existing_decisions,
            existing_playbooks,
            existing_projects,
            decision_promoted_types
        )

        if is_valid:
            valid_logs.append(enriched_log)
        else:
            orphaned_ids.append(log["id"])

    return valid_logs, orphaned_ids


def _cleanup_orphaned_logs(client, orphaned_ids: List[str], log_error) -> None:
    """
    Delete orphaned activity logs in background.

    Args:
        client: Supabase client
        orphaned_ids: List of orphaned log IDs to delete
        log_error: Error logging function
    """
    if not orphaned_ids:
        return

    try:
        for log_id in orphaned_ids:
            client.table("activity_logs").delete().eq("id", log_id).execute()
    except Exception as e:
        log_error(e, "activity.cleanup_orphaned")


def _extract_unique_related_ids(logs: List[Dict]) -> Tuple[List[str], List[str]]:
    """
    Extract unique playbook and decision IDs from logs for navigation.

    Args:
        logs: List of activity logs

    Returns:
        Tuple of (playbook_ids, decision_ids)
    """
    playbook_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "playbook" and log.get("related_id")
    ))

    decision_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "decision" and log.get("related_id")
    ))

    return playbook_ids, decision_ids
