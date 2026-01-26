"""
Members Router

Endpoints for team member management:
- Get company members
- Invite members (creates invitation, user appears after accepting)
- Update/remove members
- Manage pending invitations
- Usage statistics (owners/admins only)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta, timezone
import uuid

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
from ...services.email import send_company_member_invitation_email

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
async def invite_company_member(
    request: Request,
    company_id: ValidCompanyId,
    data: MemberInvite,
    user=Depends(get_effective_user)
):
    """
    Invite a new member to the company.
    Only owners and admins can invite members.

    Creates an invitation that the user must accept:
    - If user exists in auth.users: they receive a "Join Company" email
    - If user doesn't exist: they receive a "Create Account & Join" email

    User only appears in company_members AFTER accepting the invitation.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Get current user's role in this company
    current_user_id = user.get('id') if isinstance(user, dict) else user.id
    inviter_email = user.get('email', '') if isinstance(user, dict) else getattr(user, 'email', '')

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        log_security_event("ACCESS_DENIED", user_id=current_user_id,
                          resource_type="company_members", resource_id=company_uuid,
                          details={"action": "invite_member"}, severity="WARNING")
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Validate role
    if data.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail=t('errors.invalid_role', locale))

    email_lower = data.email.lower()

    # Check if user already exists in auth.users
    user_result = client.rpc("check_user_exists_by_email", {"p_email": email_lower}).execute()
    user_exists = False
    existing_user_id = None
    if user_result.data and len(user_result.data) > 0:
        user_exists = user_result.data[0].get("user_exists", False)
        existing_user_id = user_result.data[0].get("user_id")

    # If user exists, check if already a member
    if user_exists and existing_user_id:
        existing_member = client.table("company_members") \
            .select("id") \
            .eq("company_id", company_uuid) \
            .eq("user_id", existing_user_id) \
            .execute()

        if existing_member.data:
            raise HTTPException(status_code=400, detail=t('errors.user_already_member', locale))

    # Check for existing pending invitation
    existing_invite = client.table("platform_invitations") \
        .select("id") \
        .eq("email", email_lower) \
        .eq("target_company_id", company_uuid) \
        .eq("invitation_type", "company_member") \
        .eq("status", "pending") \
        .execute()

    if existing_invite.data:
        raise HTTPException(
            status_code=400,
            detail=t('errors.pending_invitation_exists', locale, email=data.email)
        )

    # Get company name for email
    company_result = client.table("companies") \
        .select("name") \
        .eq("id", company_uuid) \
        .single() \
        .execute()
    company_name = company_result.data.get("name", "the company") if company_result.data else "the company"

    # Create invitation
    invitation_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invitation_data = {
        "email": email_lower,
        "token": invitation_token,
        "invitation_type": "company_member",
        "status": "pending",
        "target_company_id": company_uuid,
        "target_company_role": data.role,
        "invited_by": current_user_id,
        "invited_by_email": inviter_email,
        "expires_at": expires_at.isoformat(),
        "metadata": {
            "existing_user": user_exists,
            "existing_user_id": str(existing_user_id) if existing_user_id else None,
        }
    }

    result = client.table("platform_invitations").insert(invitation_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail=t('errors.invitation_create_failed', locale))

    invitation = result.data[0]

    # Send invitation email
    inviter_name = inviter_email.split("@")[0] if inviter_email else "A team member"
    expires_at_str = expires_at.strftime("%B %d, %Y")

    email_result = await send_company_member_invitation_email(
        invitee_email=email_lower,
        inviter_name=inviter_name,
        company_name=company_name,
        invitation_token=invitation_token,
        expires_at=expires_at_str,
        is_existing_user=user_exists,
    )

    # Update email sent status
    if email_result.get("success"):
        client.table("platform_invitations").update({
            "email_sent_at": datetime.now(timezone.utc).isoformat(),
            "email_message_id": email_result.get("message_id"),
        }).eq("id", invitation["id"]).execute()

    # Log the activity
    await log_activity(
        company_id=company_uuid,
        event_type="member_invited",
        title=f"Invited new {data.role}",
        description=f"Sent invitation to {email_lower} as {data.role}"
    )

    # SECURITY: Log invitation for audit trail
    log_app_event("MEMBER_INVITED", "Member invitation sent",
                  user_id=current_user_id, resource_id=company_uuid,
                  invitee_email=email_lower, role=data.role, user_exists=user_exists)

    return {
        "success": True,
        "invitation_id": invitation["id"],
        "email": email_lower,
        "role": data.role,
        "user_exists": user_exists,
        "email_sent": email_result.get("success", False),
        "message": f"Invitation sent to {email_lower}"
    }


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
# INVITATION MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/{company_id}/invitations")
@limiter.limit("100/minute")
async def get_company_invitations(
    request: Request,
    company_id: ValidCompanyId,
    user=Depends(get_effective_user)
):
    """
    Get pending invitations for this company.
    Only owners and admins can view invitations.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Verify user is owner or admin
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .maybe_single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Get pending invitations for this company
    result = client.table("platform_invitations") \
        .select("id, email, target_company_role, status, created_at, expires_at, invited_by_email") \
        .eq("target_company_id", company_uuid) \
        .eq("invitation_type", "company_member") \
        .eq("status", "pending") \
        .order("created_at", desc=True) \
        .execute()

    return {"invitations": result.data or []}


@router.delete("/{company_id}/invitations/{invitation_id}")
@limiter.limit("20/minute")
async def cancel_company_invitation(
    request: Request,
    company_id: ValidCompanyId,
    invitation_id: str,
    user=Depends(get_effective_user)
):
    """
    Cancel a pending company member invitation.
    Only owners and admins can cancel invitations.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Verify user is owner or admin
    current_user_id = user.get('id') if isinstance(user, dict) else user.id

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .maybe_single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Get the invitation
    invitation_result = client.table("platform_invitations") \
        .select("id, email, status, target_company_id") \
        .eq("id", invitation_id) \
        .eq("target_company_id", company_uuid) \
        .eq("invitation_type", "company_member") \
        .maybe_single() \
        .execute()

    if not invitation_result.data:
        raise HTTPException(status_code=404, detail=t('errors.invitation_not_found', locale))

    invitation = invitation_result.data

    if invitation["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=t('errors.invitation_not_pending', locale, status=invitation['status'])
        )

    # Cancel the invitation
    client.table("platform_invitations").update({
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", invitation_id).execute()

    # Log the activity
    await log_activity(
        company_id=company_uuid,
        event_type="invitation_cancelled",
        title="Cancelled invitation",
        description=f"Cancelled invitation for {invitation['email']}"
    )

    log_app_event("INVITATION_CANCELLED", "Member invitation cancelled",
                  user_id=current_user_id, resource_id=company_uuid,
                  invitation_id=invitation_id, invitee_email=invitation['email'])

    return {"success": True, "message": "Invitation cancelled"}


@router.post("/{company_id}/invitations/{invitation_id}/resend")
@limiter.limit("10/minute")
async def resend_company_invitation(
    request: Request,
    company_id: ValidCompanyId,
    invitation_id: str,
    user=Depends(get_effective_user)
):
    """
    Resend a pending company member invitation email.
    Only owners and admins can resend invitations.
    """
    locale = get_locale_from_request(request)
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))

    # Verify user is owner or admin
    current_user_id = user.get('id') if isinstance(user, dict) else user.id
    inviter_email = user.get('email', '') if isinstance(user, dict) else getattr(user, 'email', '')

    my_membership = client.table("company_members") \
        .select("role") \
        .eq("company_id", company_uuid) \
        .eq("user_id", current_user_id) \
        .maybe_single() \
        .execute()

    if not my_membership.data or my_membership.data["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail=t('errors.admin_access_required', locale))

    # Get the invitation
    invitation_result = client.table("platform_invitations") \
        .select("id, email, token, status, target_company_id, target_company_role, expires_at, metadata, resend_count") \
        .eq("id", invitation_id) \
        .eq("target_company_id", company_uuid) \
        .eq("invitation_type", "company_member") \
        .maybe_single() \
        .execute()

    if not invitation_result.data:
        raise HTTPException(status_code=404, detail=t('errors.invitation_not_found', locale))

    invitation = invitation_result.data

    if invitation["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=t('errors.invitation_not_pending', locale, status=invitation['status'])
        )

    # Check expiration and extend if needed
    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
    now = datetime.now(expires_at.tzinfo)

    if expires_at < now:
        # Extend expiration by 7 days from now
        new_expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        client.table("platform_invitations").update({
            "expires_at": new_expires_at.isoformat(),
        }).eq("id", invitation_id).execute()
        expires_at_str = new_expires_at.strftime("%B %d, %Y")
    else:
        expires_at_str = expires_at.strftime("%B %d, %Y")

    # Get company name
    company_result = client.table("companies") \
        .select("name") \
        .eq("id", company_uuid) \
        .single() \
        .execute()
    company_name = company_result.data.get("name", "the company") if company_result.data else "the company"

    # Determine if user exists
    metadata = invitation.get("metadata", {})
    user_exists = metadata.get("existing_user", False)

    # Send email
    inviter_name = inviter_email.split("@")[0] if inviter_email else "A team member"

    email_result = await send_company_member_invitation_email(
        invitee_email=invitation["email"],
        inviter_name=inviter_name,
        company_name=company_name,
        invitation_token=invitation["token"],
        expires_at=expires_at_str,
        is_existing_user=user_exists,
    )

    # Update resend count
    resend_count = (invitation.get("resend_count") or 0) + 1
    client.table("platform_invitations").update({
        "resend_count": resend_count,
        "last_resent_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", invitation_id).execute()

    log_app_event("INVITATION_RESENT", "Member invitation resent",
                  user_id=current_user_id, resource_id=company_uuid,
                  invitation_id=invitation_id, invitee_email=invitation['email'],
                  resend_count=resend_count)

    return {
        "success": True,
        "message": f"Invitation resent to {invitation['email']}",
        "resend_count": resend_count,
    }


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
        first_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

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
