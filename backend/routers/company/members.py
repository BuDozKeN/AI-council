"""
Members Router

Endpoints for team member management:
- Get company members
- Add/remove members
- Update member roles
- Usage statistics (owners/admins only)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime

from ...auth import get_current_user, get_effective_user
from ...security import log_security_event, log_app_event, log_error
from ...i18n import t, get_locale_from_request
from .utils import (
    get_service_client,
    verify_company_access,
    resolve_company_id,
    log_activity,
    ValidCompanyId,
    MemberInvite,
    MemberUpdate,
)

# Import shared rate limiter (ensures limits are tracked globally)
from ...rate_limit import limiter


router = APIRouter(prefix="/company", tags=["company-members"])


# =============================================================================
# TEAM MEMBERS ENDPOINTS
# =============================================================================
# Per Council recommendation: Simple team management
# - Single owner per company
# - Roles: owner, admin, member
# - No email sending yet - manual addition only

@router.get("/{company_id}/members")
@limiter.limit("100/minute;500/hour")
async def get_company_members(request: Request, company_id: ValidCompanyId,
    user=Depends(get_effective_user)
):
    """
    Get all members of the company with their roles.
    Any company member can view the member list.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # SECURITY: Verify user has access to this company
    verify_company_access(client, company_uuid, user)

    # Get all members with their user info
    result = client.table("company_members") \
        .select("id, user_id, role, joined_at, created_at") \
        .eq("company_id", company_uuid) \
        .order("created_at") \
        .execute()

    if not result.data:
        return {"members": []}

    # Get user emails from auth.users via RPC or direct query
    # Since we can't directly query auth.users, we'll return user_ids
    # Frontend can match with current user or we add a users view later
    members = []
    for member in result.data:
        members.append({
            "id": member["id"],
            "user_id": member["user_id"],
            "role": member["role"],
            "joined_at": member["joined_at"],
            "created_at": member["created_at"]
        })

    return {"members": members}


@router.post("/{company_id}/members")
@limiter.limit("20/minute")
async def add_company_member(
    request: Request,
    company_id: ValidCompanyId,
    data: MemberInvite,
    user=Depends(get_effective_user)
):
    """
    Add a new member to the company.
    Only owners and admins can add members.

    For MVP: Directly adds member by user_id (assumes user already exists in auth.users).
    Future: Will use invitation system with email.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Get current user's role in this company
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        log_security_event("ACCESS_DENIED", user_id=current_user_id,
                          resource_type="company_members", resource_id=company_uuid,
                          details={"action": "add_member"}, severity="WARNING")
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Validate role
    if data.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail=t('errors.invalid_role', locale))

    # Look up user by email in auth.users
    # Using service client to access auth schema
    user_result = client.rpc("get_user_id_by_email", {"user_email": data.email}).execute()

    if not user_result.data:
        raise HTTPException(
            status_code=404,
            detail=t('errors.user_not_found_by_email', locale, email=data.email)
        )

    new_user_id = user_result.data

    # Check if already a member
    existing = client.table("company_members") \
        .select("id") \
        .eq("company_id", company_uuid) \
        .eq("user_id", new_user_id) \
        .execute()

    if existing.data:
        raise HTTPException(status_code=400, detail=t('errors.user_already_member', locale))

    # Add the member
    result = client.table("company_members").insert({
        "company_id": company_uuid,
        "user_id": new_user_id,
        "role": data.role,
        "invited_by": current_user_id
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail=t('errors.member_add_failed', locale))

    # Log the activity
    await log_activity(
        company_id=company_uuid,
        event_type="member_added",
        title=f"Added new {data.role}",
        description=f"Added user as {data.role}"
    )

    # SECURITY: Log member addition for audit trail
    log_app_event("MEMBER_ADDED", "New member added to company",
                  user_id=current_user_id, resource_id=company_uuid,
                  role=data.role)

    return {"member": result.data[0], "message": f"Member added successfully as {data.role}"}


@router.patch("/{company_id}/members/{member_id}")
@limiter.limit("30/minute;100/hour")
async def update_company_member(request: Request, company_id: ValidCompanyId,
    member_id: str,
    data: MemberUpdate,
    user=Depends(get_effective_user)
):
    """
    Update a member's role.
    - Owners can change anyone's role (except their own owner status)
    - Admins can only change member roles (not other admins or owner)
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Validate role
    if data.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail=t('errors.invalid_role', locale))

    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    # Get current user's role
    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    my_role = my_membership.data["role"]

    # Get target member's current role
    target = client.table("company_members") \
        .select("id, role, user_id") \
        .eq("id", member_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not target.data:
        raise HTTPException(status_code=404, detail=t('errors.member_not_found', locale))

    target_role = target.data["role"]

    # Permission checks
    if target_role == "owner":
        raise HTTPException(status_code=403, detail=t('errors.cannot_change_owner_role', locale))

    if my_role == "admin" and target_role == "admin":
        raise HTTPException(status_code=403, detail=t('errors.admin_cannot_modify_admin', locale))

    # Update the role
    result = client.table("company_members") \
        .update({"role": data.role}) \
        .eq("id", member_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail=t('errors.member_update_failed', locale))

    await log_activity(
        company_id=company_uuid,
        event_type="member_updated",
        title=f"Changed role to {data.role}",
        description=f"Member role changed from {target_role} to {data.role}"
    )

    return {"member": result.data[0], "message": f"Role updated to {data.role}"}


@router.delete("/{company_id}/members/{member_id}")
@limiter.limit("20/minute;50/hour")
async def remove_company_member(request: Request, company_id: ValidCompanyId,
    member_id: str,
    user=Depends(get_effective_user)
):
    """
    Remove a member from the company.
    - Owners can remove anyone except themselves
    - Admins can only remove regular members
    - Members cannot remove anyone
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    # Get current user's role
    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        log_security_event("ACCESS_DENIED", user_id=current_user_id,
                          resource_type="company_members", resource_id=company_uuid,
                          details={"action": "remove_member"}, severity="WARNING")
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    my_role = my_membership.data["role"]

    # Get target member
    target = client.table("company_members") \
        .select("id, role, user_id") \
        .eq("id", member_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not target.data:
        raise HTTPException(status_code=404, detail=t('errors.member_not_found', locale))

    target_role = target.data["role"]
    target_user_id = target.data["user_id"]

    # Permission checks
    if target_user_id == current_user_id:
        raise HTTPException(status_code=403, detail=t('errors.cannot_remove_yourself', locale))

    if target_role == "owner":
        raise HTTPException(status_code=403, detail=t('errors.cannot_remove_owner', locale))

    if my_role == "admin" and target_role == "admin":
        raise HTTPException(status_code=403, detail=t('errors.admin_cannot_remove_admin', locale))

    # Remove the member
    client.table("company_members") \
        .delete() \
        .eq("id", member_id) \
        .execute()

    await log_activity(
        company_id=company_uuid,
        event_type="member_removed",
        title=f"Removed {target_role}",
        description=f"Member with role {target_role} was removed"
    )

    # SECURITY: Log member removal for audit trail
    log_app_event("MEMBER_REMOVED", "Member removed from company",
                  user_id=current_user_id, resource_id=company_uuid,
                  target_role=target_role)

    return {"message": "Member removed successfully"}


# =============================================================================
# USAGE TRACKING ENDPOINTS
# =============================================================================
# Per Council recommendation: Privacy by design
# - Aggregate usage only (no user_id tracking)
# - Only owners/admins can view usage

@router.get("/{company_id}/usage")
@limiter.limit("100/minute;500/hour")
async def get_company_usage(request: Request, company_id: ValidCompanyId,
    user=Depends(get_effective_user)
):
    """
    Get usage statistics for the company.
    Only owners and admins can view usage data.

    Returns aggregate data only - no user-level breakdown (privacy by design).
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Check if user is owner or admin
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    try:
        my_membership = client.table("company_members") \
            .select("role") \
            .eq("company_id", company_uuid) \
            .eq("user_id", current_user_id) \
            .maybe_single() \
            .execute()

        if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))
    except HTTPException:
        raise
    except Exception:
        # company_members table might not exist yet, fall back to owner check
        try:
            company_check = client.table("companies") \
                .select("user_id") \
                .eq("id", company_uuid) \
                .maybe_single() \
                .execute()
            if not company_check.data or company_check.data.get("user_id") != current_user_id:
                raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))
        except HTTPException:
            raise
        except Exception as e:
            log_error(e, "members.get_usage_permission_check")
            raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Get usage data - handle case where usage_events table might not exist
    try:
        # Get all-time usage (only select id for counting - token columns may not exist yet)
        all_time = client.table("usage_events") \
            .select("id") \
            .eq("company_id", company_uuid) \
            .execute()

        total_sessions = len(all_time.data) if all_time.data else 0

        # Get this month's usage
        first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        this_month = client.table("usage_events") \
            .select("id") \
            .eq("company_id", company_uuid) \
            .gte("created_at", first_of_month.isoformat()) \
            .execute()

        month_sessions = len(this_month.data) if this_month.data else 0

        # Token tracking not yet implemented - return zeros for now
        total_input = 0
        total_output = 0
        month_input = 0
        month_output = 0
    except Exception as e:
        log_error(e, "members.get_usage_data")
        # usage_events table might not exist yet - return zeros
        total_sessions = 0
        total_input = 0
        total_output = 0
        month_sessions = 0
        month_input = 0
        month_output = 0

    return {
        "usage": {
            "total_sessions": total_sessions,
            "total_tokens_input": total_input,
            "total_tokens_output": total_output,
            "sessions_this_month": month_sessions,
            "tokens_this_month_input": month_input,
            "tokens_this_month_output": month_output
        }
    }
