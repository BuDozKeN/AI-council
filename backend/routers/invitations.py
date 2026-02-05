"""
Invitations Router

Endpoints for invitation acceptance flow:
- Validate invitation token (public)
- Accept invitation after signup (public)
- Accept company member invitation (authenticated - for existing users)

Some endpoints are public (no auth), some require authentication.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional

from ..database import get_supabase_service
from ..security import log_app_event
from ..i18n import t, get_locale_from_request
from ..auth import get_current_user

# Import shared rate limiter
from ..rate_limit import limiter


router = APIRouter(prefix="/invitations", tags=["invitations"])


# =============================================================================
# SECURITY HELPERS
# =============================================================================

def sanitize_company_role(role: str | None) -> str:
    """
    Sanitize company role from invitation.

    SECURITY: Owner role cannot be granted via invitation.
    Owner is assigned only when creating a company (companies.user_id).
    This is defense-in-depth - DB constraint also enforces this.
    """
    if role == "owner":
        log_app_event(
            "SECURITY: Attempted to grant owner role via invitation - downgraded to admin",
            level="WARNING",
            attempted_role=role,
        )
        return "admin"
    return role if role in ("admin", "member") else "member"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class InvitationValidation(BaseModel):
    """Response for invitation validation."""
    is_valid: bool
    email: Optional[str] = None
    name: Optional[str] = None
    expires_at: Optional[str] = None
    target_company_name: Optional[str] = None
    error: Optional[str] = None


class AcceptInvitationRequest(BaseModel):
    """Request to mark invitation as accepted."""
    user_id: str  # The new user's ID after Supabase signup


class AcceptInvitationResponse(BaseModel):
    """Response after accepting invitation."""
    success: bool
    message: str
    added_to_company: bool = False
    company_name: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/validate")
@limiter.limit("30/minute")
async def validate_invitation(
    request: Request,
    token: str = Query(..., description="Invitation token from email"),
):
    """
    Validate an invitation token.

    This is called from the /accept-invite page to check if the token is valid
    before showing the signup form.

    No authentication required.
    """
    try:
        supabase = get_supabase_service()

        # Get invitation by token
        result = supabase.table("platform_invitations").select(
            "id, email, name, status, expires_at, target_company_id"
        ).eq("token", token).maybe_single().execute()

        if not result or not result.data:
            log_app_event(
                "INVITATION: Invalid token attempted",
                token_prefix=token[:8] if token else None,
            )
            return InvitationValidation(
                is_valid=False,
                error="Invalid invitation link"
            )

        invitation = result.data

        # Check status
        if invitation["status"] != "pending":
            return InvitationValidation(
                is_valid=False,
                error=f"This invitation has already been {invitation['status']}"
            )

        # Check expiration
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            # Mark as expired
            supabase.table("platform_invitations").update({
                "status": "expired"
            }).eq("id", invitation["id"]).execute()

            return InvitationValidation(
                is_valid=False,
                error="This invitation has expired"
            )

        # Get target company name if specified
        target_company_name = None
        if invitation.get("target_company_id"):
            company_result = supabase.table("companies").select(
                "name"
            ).eq("id", invitation["target_company_id"]).maybe_single().execute()
            if company_result and company_result.data:
                target_company_name = company_result.data.get("name")

        log_app_event(
            "INVITATION: Token validated",
            invitation_id=invitation["id"],
            email=invitation["email"],
        )

        return InvitationValidation(
            is_valid=True,
            email=invitation["email"],
            name=invitation.get("name"),
            expires_at=invitation["expires_at"],
            target_company_name=target_company_name,
        )

    except Exception as e:
        log_app_event(
            "INVITATION: Validation error",
            level="ERROR",
            error=str(e)
        )
        return InvitationValidation(
            is_valid=False,
            error="An error occurred validating the invitation"
        )


@router.post("/accept")
@limiter.limit("10/minute")
async def accept_invitation(
    request: Request,
    token: str = Query(..., description="Invitation token from email"),
    data: AcceptInvitationRequest = None,
):
    """
    Accept an invitation after successful Supabase signup.

    This is called AFTER the user has completed signup via Supabase Auth.
    It marks the invitation as accepted and optionally adds the user to a company.

    Flow:
    1. User arrives at /accept-invite?token=xxx
    2. Frontend validates token via /invitations/validate
    3. User signs up via Supabase Auth (creates auth.users record)
    4. Frontend calls this endpoint with the new user_id
    5. This marks invitation as accepted and adds user to company if specified

    No authentication required (user just created account).
    """
    locale = get_locale_from_request(request)
    try:
        supabase = get_supabase_service()

        # Get invitation by token
        result = supabase.table("platform_invitations").select(
            "id, email, status, expires_at, target_company_id, target_company_role"
        ).eq("token", token).maybe_single().execute()

        if not result or not result.data:
            raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", locale))

        invitation = result.data

        # Validate status
        if invitation["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=t("errors.invitation_already_used", locale, status=invitation['status'])
            )

        # Check expiration
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            supabase.table("platform_invitations").update({
                "status": "expired"
            }).eq("id", invitation["id"]).execute()
            raise HTTPException(status_code=400, detail=t("errors.invitation_expired", locale))

        # Verify the user exists in auth.users
        try:
            user_response = supabase.auth.admin.get_user_by_id(data.user_id)
            if not user_response.user:
                raise HTTPException(status_code=400, detail=t("errors.user_not_found", locale))

            # Verify email matches
            if user_response.user.email.lower() != invitation["email"].lower():
                raise HTTPException(
                    status_code=400,
                    detail=t("errors.user_email_mismatch", locale)
                )
        except HTTPException:
            raise
        except Exception as e:
            log_app_event(
                "INVITATION: User verification failed",
                level="ERROR",
                user_id=data.user_id,
                error=str(e)
            )
            raise HTTPException(status_code=400, detail=t("errors.could_not_verify_user", locale))

        # Mark invitation as accepted
        supabase.table("platform_invitations").update({
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "accepted_user_id": data.user_id,
        }).eq("id", invitation["id"]).execute()

        # Add to company if specified
        added_to_company = False
        company_name = None

        if invitation.get("target_company_id"):
            try:
                # Get company name
                company_result = supabase.table("companies").select(
                    "name"
                ).eq("id", invitation["target_company_id"]).maybe_single().execute()
                if company_result and company_result.data:
                    company_name = company_result.data.get("name")

                # Add as company member
                # SECURITY: Sanitize role - owner cannot be granted via invitation
                effective_role = sanitize_company_role(invitation.get("target_company_role"))
                supabase.table("company_members").upsert({
                    "company_id": invitation["target_company_id"],
                    "user_id": data.user_id,
                    "role": effective_role,
                }).execute()

                added_to_company = True

                log_app_event(
                    "INVITATION: User added to company",
                    user_id=data.user_id,
                    company_id=invitation["target_company_id"],
                    role=effective_role,
                )

            except Exception as e:
                log_app_event(
                    "INVITATION: Failed to add user to company",
                    level="ERROR",
                    user_id=data.user_id,
                    company_id=invitation["target_company_id"],
                    error=str(e)
                )
                # Don't fail the whole acceptance, just log the error

        log_app_event(
            "INVITATION: Accepted",
            invitation_id=invitation["id"],
            user_id=data.user_id,
            email=invitation["email"],
            added_to_company=added_to_company,
        )

        return AcceptInvitationResponse(
            success=True,
            message="Invitation accepted successfully",
            added_to_company=added_to_company,
            company_name=company_name,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "INVITATION: Accept error",
            level="ERROR",
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=t("errors.invitation_accept_failed", locale))


# =============================================================================
# AUTHENTICATED ENDPOINTS (for existing users)
# =============================================================================

class AcceptCompanyInvitationResponse(BaseModel):
    """Response after accepting a company member invitation."""
    success: bool
    message: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None


@router.post("/accept-company")
@limiter.limit("10/minute")
async def accept_company_invitation(
    request: Request,
    token: str = Query(..., description="Invitation token from email"),
    user: dict = Depends(get_current_user),
):
    """
    Accept a company member invitation as an existing authenticated user.

    This endpoint is for users who already have accounts and are accepting
    an invitation to join a company. They must be logged in.

    Flow:
    1. User receives company invitation email
    2. User clicks "Accept & Join" link
    3. If not logged in, redirected to login, then back to acceptance page
    4. Frontend calls this endpoint with the token
    5. User is added to company_members

    Requires authentication.
    """
    locale = get_locale_from_request(request)

    try:
        supabase = get_supabase_service()
        user_id = user.get("id") if isinstance(user, dict) else user.id
        user_email = user.get("email", "").lower() if isinstance(user, dict) else getattr(user, "email", "").lower()

        # Get invitation by token
        result = supabase.table("platform_invitations").select(
            "id, email, status, expires_at, target_company_id, target_company_role, invitation_type"
        ).eq("token", token).maybe_single().execute()

        if not result or not result.data:
            raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", locale))

        invitation = result.data

        # Must be a company_member invitation
        if invitation.get("invitation_type") != "company_member":
            raise HTTPException(
                status_code=400,
                detail=t("errors.invitation_requires_signup", locale)
            )

        # Verify email matches
        if invitation["email"].lower() != user_email:
            log_app_event(
                "INVITATION: Email mismatch on company acceptance",
                level="WARNING",
                invitation_email=invitation["email"],
                user_email=user_email,
            )
            raise HTTPException(
                status_code=403,
                detail=t("errors.invitation_email_mismatch", locale, email=invitation["email"])
            )

        # Validate status
        if invitation["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=t("errors.invitation_already_used", locale, status=invitation['status'])
            )

        # Check expiration
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            supabase.table("platform_invitations").update({
                "status": "expired"
            }).eq("id", invitation["id"]).execute()
            raise HTTPException(status_code=400, detail=t("errors.invitation_expired", locale))

        # Check if already a member
        existing_member = supabase.table("company_members") \
            .select("id") \
            .eq("company_id", invitation["target_company_id"]) \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()

        if existing_member.data:
            # Already a member - mark invitation as accepted and return success
            supabase.table("platform_invitations").update({
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "accepted_user_id": user_id,
            }).eq("id", invitation["id"]).execute()

            # Get company name
            company_result = supabase.table("companies").select(
                "name"
            ).eq("id", invitation["target_company_id"]).maybe_single().execute()
            company_name = company_result.data.get("name") if company_result.data else None

            return AcceptCompanyInvitationResponse(
                success=True,
                message="You are already a member of this company",
                company_id=invitation["target_company_id"],
                company_name=company_name,
            )

        # Mark invitation as accepted
        supabase.table("platform_invitations").update({
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "accepted_user_id": user_id,
        }).eq("id", invitation["id"]).execute()

        # Add to company_members
        # SECURITY: Sanitize role - owner cannot be granted via invitation
        effective_role = sanitize_company_role(invitation.get("target_company_role"))
        supabase.table("company_members").insert({
            "company_id": invitation["target_company_id"],
            "user_id": user_id,
            "role": effective_role,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        # Get company name for response
        company_result = supabase.table("companies").select(
            "name"
        ).eq("id", invitation["target_company_id"]).maybe_single().execute()
        company_name = company_result.data.get("name") if company_result.data else None

        log_app_event(
            "INVITATION: Company member invitation accepted",
            user_id=user_id,
            invitation_id=invitation["id"],
            company_id=invitation["target_company_id"],
            role=effective_role,
        )

        return AcceptCompanyInvitationResponse(
            success=True,
            message=f"You have joined {company_name or 'the company'}",
            company_id=invitation["target_company_id"],
            company_name=company_name,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "INVITATION: Company accept error",
            level="ERROR",
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=t("errors.invitation_accept_failed", locale))
