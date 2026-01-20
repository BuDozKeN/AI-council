"""
Invitations Router (Public)

Public endpoints for invitation acceptance flow:
- Validate invitation token
- Accept invitation (after Supabase signup)

These endpoints are accessible without authentication.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional

from ..database import get_supabase_service
from ..security import log_app_event

# Import shared rate limiter
from ..rate_limit import limiter


router = APIRouter(prefix="/invitations", tags=["invitations"])


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
    try:
        supabase = get_supabase_service()

        # Get invitation by token
        result = supabase.table("platform_invitations").select(
            "id, email, status, expires_at, target_company_id, target_company_role"
        ).eq("token", token).maybe_single().execute()

        if not result or not result.data:
            raise HTTPException(status_code=404, detail="Invalid invitation")

        invitation = result.data

        # Validate status
        if invitation["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Invitation has already been {invitation['status']}"
            )

        # Check expiration
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(expires_at.tzinfo):
            supabase.table("platform_invitations").update({
                "status": "expired"
            }).eq("id", invitation["id"]).execute()
            raise HTTPException(status_code=400, detail="Invitation has expired")

        # Verify the user exists in auth.users
        try:
            user_response = supabase.auth.admin.get_user_by_id(data.user_id)
            if not user_response.user:
                raise HTTPException(status_code=400, detail="User not found")

            # Verify email matches
            if user_response.user.email.lower() != invitation["email"].lower():
                raise HTTPException(
                    status_code=400,
                    detail="User email does not match invitation"
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
            raise HTTPException(status_code=400, detail="Could not verify user")

        # Mark invitation as accepted
        supabase.table("platform_invitations").update({
            "status": "accepted",
            "accepted_at": datetime.utcnow().isoformat(),
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
                supabase.table("company_members").upsert({
                    "company_id": invitation["target_company_id"],
                    "user_id": data.user_id,
                    "role": invitation.get("target_company_role", "member"),
                    "status": "active",
                }).execute()

                added_to_company = True

                log_app_event(
                    "INVITATION: User added to company",
                    user_id=data.user_id,
                    company_id=invitation["target_company_id"],
                    role=invitation.get("target_company_role", "member"),
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
        raise HTTPException(status_code=500, detail="Failed to accept invitation")
