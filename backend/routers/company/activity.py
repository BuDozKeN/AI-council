"""
Activity Router

Endpoints for activity log management:
- Get activity logs with filtering
- Cleanup orphaned activity entries
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timedelta

from ...auth import get_current_user
from ...security import log_error
from .utils import (
    get_service_client,
    verify_company_access,
    resolve_company_id,
    ValidCompanyId,
)


router = APIRouter(prefix="/api/company", tags=["company-activity"])


# =============================================================================
# ACTIVITY ENDPOINTS
# =============================================================================

@router.get("/{company_id}/activity")
async def get_activity_logs(
    company_id: ValidCompanyId,
    limit: int = 50,
    event_type: Optional[str] = None,
    days: Optional[int] = None,
    user=Depends(get_current_user)
):
    """
    Get activity logs for a company.
    Optional filter by event_type (decision, playbook, role, department, council_session).
    Optional filter by days (1 = today, 7 = last week, 30 = last month).

    Automatically filters out orphaned entries (referencing deleted items).
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"logs": [], "playbook_ids": [], "decision_ids": []}

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Fetch more than requested to account for filtering orphans
    fetch_limit = limit * 2

    query = client.table("activity_logs") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("created_at", desc=True) \
        .limit(fetch_limit)

    if event_type:
        query = query.eq("event_type", event_type)

    # Filter by date range if specified
    if days:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        query = query.gte("created_at", cutoff)

    result = query.execute()
    all_logs = result.data or []

    # Collect IDs to check for existence (batch queries for efficiency)
    decision_ids_to_check = set()
    playbook_ids_to_check = set()
    project_ids_to_check = set()

    for log in all_logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")
        if related_id and related_type:
            if related_type == "decision":
                decision_ids_to_check.add(related_id)
            elif related_type == "playbook":
                playbook_ids_to_check.add(related_id)
            elif related_type == "project":
                project_ids_to_check.add(related_id)

    # Batch check existence
    existing_decisions = set()
    existing_playbooks = set()
    existing_projects = set()

    # Also fetch promoted_to_type to enrich activity logs with current state
    decision_promoted_types = {}
    if decision_ids_to_check:
        try:
            result = client.table("knowledge_entries") \
                .select("id, promoted_to_type, project_id") \
                .in_("id", list(decision_ids_to_check)) \
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
            existing_decisions = decision_ids_to_check  # Assume all exist on error

    if playbook_ids_to_check:
        try:
            result = client.table("org_documents") \
                .select("id") \
                .in_("id", list(playbook_ids_to_check)) \
                .eq("is_active", True) \
                .execute()
            existing_playbooks = {r["id"] for r in (result.data or [])}
        except Exception as e:
            log_error(e, "activity.batch_check_playbooks")
            existing_playbooks = playbook_ids_to_check

    if project_ids_to_check:
        try:
            result = client.table("projects") \
                .select("id") \
                .in_("id", list(project_ids_to_check)) \
                .execute()
            existing_projects = {r["id"] for r in (result.data or [])}
        except Exception as e:
            log_error(e, "activity.batch_check_projects")
            existing_projects = project_ids_to_check

    # Filter out orphaned logs and enrich with current state
    valid_logs = []
    orphaned_ids = []
    for log in all_logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")

        # Keep logs without related items (e.g., general events)
        if not related_id or not related_type:
            valid_logs.append(log)
            continue

        # Check if related item exists
        exists = True
        if related_type == "decision":
            exists = related_id in existing_decisions
            # Enrich with current promoted_to_type (decision may have been promoted since activity was logged)
            if exists and related_id in decision_promoted_types:
                log = {**log, "promoted_to_type": decision_promoted_types[related_id]}
        elif related_type == "playbook":
            exists = related_id in existing_playbooks
        elif related_type == "project":
            exists = related_id in existing_projects
            # For project-type activities, ensure promoted_to_type is set
            if exists and not log.get("promoted_to_type"):
                log = {**log, "promoted_to_type": "project"}

        if exists:
            valid_logs.append(log)
        else:
            orphaned_ids.append(log["id"])

    # Auto-cleanup orphaned logs in background (don't wait)
    if orphaned_ids:
        try:
            for log_id in orphaned_ids:
                client.table("activity_logs").delete().eq("id", log_id).execute()
        except Exception as e:
            log_error(e, "activity.cleanup_orphaned")

    # Return only up to the requested limit
    logs = valid_logs[:limit]

    # Extract unique related IDs for navigation
    playbook_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "playbook" and log.get("related_id")
    ))
    decision_ids = list(set(
        log["related_id"] for log in logs
        if log.get("related_type") == "decision" and log.get("related_id")
    ))

    return {"logs": logs, "playbook_ids": playbook_ids, "decision_ids": decision_ids}


@router.delete("/{company_id}/activity/cleanup")
async def cleanup_orphaned_activity_logs(
    company_id: ValidCompanyId,
    user=Depends(get_current_user)
):
    """
    Remove activity log entries that reference non-existent items.
    This helps clean up the Activity tab when referenced items have been deleted.
    """
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"deleted_count": 0, "message": "Company not found"}

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Get all activity logs for this company
    logs_result = client.table("activity_logs") \
        .select("id, related_id, related_type") \
        .eq("company_id", company_uuid) \
        .execute()

    logs = logs_result.data or []
    orphaned_ids = []

    # Performance: Batch check existence by type (avoids N+1 queries)
    # Group related IDs by type
    decision_ids = []
    playbook_ids = []
    project_ids = []
    log_id_to_related = {}  # Map log ID to (related_id, related_type)

    for log in logs:
        related_id = log.get("related_id")
        related_type = log.get("related_type")

        if not related_id or not related_type:
            continue

        log_id_to_related[log["id"]] = (related_id, related_type)

        if related_type == "decision":
            decision_ids.append(related_id)
        elif related_type == "playbook":
            playbook_ids.append(related_id)
        elif related_type == "project":
            project_ids.append(related_id)

    # Batch fetch existing items (3 queries max instead of N)
    existing_decisions = set()
    existing_playbooks = set()
    existing_projects = set()

    try:
        if decision_ids:
            result = client.table("knowledge_entries") \
                .select("id") \
                .in_("id", decision_ids) \
                .eq("is_active", True) \
                .execute()
            existing_decisions = {r["id"] for r in (result.data or [])}

        if playbook_ids:
            result = client.table("org_documents") \
                .select("id") \
                .in_("id", playbook_ids) \
                .eq("is_active", True) \
                .execute()
            existing_playbooks = {r["id"] for r in (result.data or [])}

        if project_ids:
            result = client.table("projects") \
                .select("id") \
                .in_("id", project_ids) \
                .execute()
            existing_projects = {r["id"] for r in (result.data or [])}
    except Exception as e:
        log_error(e, "activity.cleanup_batch_check")
        # If batch check fails, abort cleanup to be safe
        return {"deleted_count": 0, "total_checked": len(logs), "message": "Cleanup aborted due to error"}

    # Identify orphaned logs
    for log_id, (related_id, related_type) in log_id_to_related.items():
        exists = False
        if related_type == "decision":
            exists = related_id in existing_decisions
        elif related_type == "playbook":
            exists = related_id in existing_playbooks
        elif related_type == "project":
            exists = related_id in existing_projects
        else:
            # Unknown type - keep the log
            exists = True

        if not exists:
            orphaned_ids.append(log_id)

    # Delete orphaned logs in batches (1 query per batch instead of N)
    deleted_count = 0
    if orphaned_ids:
        try:
            # Supabase supports .in_() for batch delete
            client.table("activity_logs").delete().in_("id", orphaned_ids).execute()
            deleted_count = len(orphaned_ids)
        except Exception as e:
            log_error(e, "activity.cleanup_batch_delete")

    return {
        "deleted_count": deleted_count,
        "total_checked": len(logs),
        "message": f"Cleaned up {deleted_count} orphaned activity logs"
    }
