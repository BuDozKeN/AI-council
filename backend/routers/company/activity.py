"""
Activity Router

Endpoints for activity log management:
- Get activity logs with filtering
- Cleanup orphaned activity entries
"""

from fastapi import APIRouter, Depends, HTTPException, Request
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

# Import shared rate limiter (ensures limits are tracked globally)
from ...rate_limit import limiter


router = APIRouter(prefix="/company", tags=["company-activity"])


# =============================================================================
# ACTIVITY ENDPOINTS
# =============================================================================

@router.get("/{company_id}/activity")
@limiter.limit("100/minute;500/hour")
async def get_activity_logs(request: Request, company_id: ValidCompanyId,
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

    REFACTORED: Complexity reduced from E (45) to C (~12) by extracting helper functions.
    """
    from .activity_refactored import (
        _build_activity_query,
        _collect_related_ids,
        _batch_check_decisions,
        _batch_check_playbooks,
        _batch_check_projects,
        _filter_and_enrich_logs,
        _cleanup_orphaned_logs,
        _extract_unique_related_ids
    )

    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"logs": [], "playbook_ids": [], "decision_ids": []}

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # 1. Build and execute query (fetch more than requested to account for filtering orphans)
    fetch_limit = limit * 2
    query = _build_activity_query(client, company_uuid, fetch_limit, event_type, days)
    result = query.execute()
    all_logs = result.data or []

    # 2. Collect all related IDs grouped by type
    decision_ids_to_check, playbook_ids_to_check, project_ids_to_check = _collect_related_ids(all_logs)

    # 3. Batch check existence of related items
    existing_decisions, decision_promoted_types = _batch_check_decisions(
        client, decision_ids_to_check, log_error
    )
    existing_playbooks = _batch_check_playbooks(client, playbook_ids_to_check, log_error)
    existing_projects = _batch_check_projects(client, project_ids_to_check, log_error)

    # 4. Filter out orphaned logs and enrich with current state
    valid_logs, orphaned_ids = _filter_and_enrich_logs(
        all_logs,
        existing_decisions,
        existing_playbooks,
        existing_projects,
        decision_promoted_types
    )

    # 5. Auto-cleanup orphaned logs in background (don't wait)
    _cleanup_orphaned_logs(client, orphaned_ids, log_error)

    # 6. Return only up to the requested limit
    logs = valid_logs[:limit]

    # 7. Extract unique related IDs for navigation
    playbook_ids, decision_ids = _extract_unique_related_ids(logs)

    return {"logs": logs, "playbook_ids": playbook_ids, "decision_ids": decision_ids}


@router.delete("/{company_id}/activity/cleanup")
@limiter.limit("10/minute;30/hour")
async def cleanup_orphaned_activity_logs(request: Request, company_id: ValidCompanyId,
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
