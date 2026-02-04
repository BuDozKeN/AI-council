"""
Admin Router

Platform administration endpoints for super admins:
- Check admin access
- List all users across all companies
- Manage platform admins
- View audit logs
- Platform invitations
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Path
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
import uuid

from ..auth import get_current_user
from ..database import get_supabase_service, get_supabase_with_auth
from ..security import SecureHTTPException, log_app_event, escape_sql_like_pattern
from ..services.email import send_invitation_email
from .. import leaderboard as leaderboard_module
from ..i18n import t, get_locale_from_request

# Import shared rate limiter
from ..rate_limit import limiter

import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/admin", tags=["admin"])


# =============================================================================
# AUDIT LOG TYPES
# =============================================================================

# Valid action categories for audit logging
AuditActionCategory = Literal[
    "auth", "user", "company", "admin", "data", "api", "billing", "security"
]


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class AdminAccessResponse(BaseModel):
    """Response for admin access check."""
    is_admin: bool
    role: Optional[str] = None


class AdminUser(BaseModel):
    """Admin user info."""
    id: str
    email: str
    role: str
    created_at: str  # When admin access was granted
    user_metadata: Optional[dict] = None


class PlatformUser(BaseModel):
    """User info for admin listing."""
    id: str
    email: str
    created_at: str
    last_sign_in_at: Optional[str] = None
    email_confirmed_at: Optional[str] = None
    user_metadata: Optional[dict] = None


class ListUsersResponse(BaseModel):
    """Response for listing users."""
    users: List[PlatformUser]
    total: int
    page: int
    page_size: int


class CompanyInfo(BaseModel):
    """Company info for admin listing."""
    id: str
    name: str
    created_at: str
    user_count: int = 0
    conversation_count: int = 0
    owner_email: Optional[str] = None


class ListCompaniesResponse(BaseModel):
    """Response for listing companies."""
    companies: List[CompanyInfo]
    total: int
    page: int
    page_size: int


class AuditLogEntry(BaseModel):
    """Audit log entry for admin viewing."""
    id: str
    timestamp: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_type: str
    action: str
    action_category: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    company_id: Optional[str] = None
    ip_address: Optional[str] = None
    metadata: Optional[dict] = None


class ListAuditLogsResponse(BaseModel):
    """Response for listing audit logs."""
    logs: List[AuditLogEntry]
    total: int
    page: int
    page_size: int


class AuditLogFilters(BaseModel):
    """Filters for audit log queries."""
    action_category: Optional[str] = None
    actor_id: Optional[str] = None
    resource_type: Optional[str] = None
    company_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class PlatformStats(BaseModel):
    """Platform-wide statistics."""
    total_users: int
    total_companies: int
    total_conversations: int
    total_messages: int
    active_users_24h: int
    active_users_7d: int


# -----------------------------------------------------------------------------
# Model Analytics Models
# -----------------------------------------------------------------------------

class ModelRanking(BaseModel):
    """Individual model ranking data."""
    model: str
    avg_rank: float
    sessions: int
    wins: int
    win_rate: float


class DepartmentLeaderboard(BaseModel):
    """Leaderboard for a specific department."""
    department: str
    leader: Optional[ModelRanking] = None
    sessions: int
    leaderboard: List[ModelRanking]


class ModelAnalyticsResponse(BaseModel):
    """Response for model analytics endpoint."""
    overall_leader: Optional[ModelRanking] = None
    total_sessions: int
    overall_leaderboard: List[ModelRanking]
    departments: List[DepartmentLeaderboard]


# -----------------------------------------------------------------------------
# Invitation Models
# -----------------------------------------------------------------------------

class CreateInvitationRequest(BaseModel):
    """Request to create a platform invitation."""
    email: EmailStr
    name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    target_company_id: Optional[str] = None
    target_company_role: Optional[str] = Field(None, pattern="^(owner|admin|member)$")


class InvitationInfo(BaseModel):
    """Invitation info for admin listing."""
    id: str
    email: str
    name: Optional[str] = None
    status: str
    invited_by_email: Optional[str] = None
    created_at: str
    expires_at: str
    accepted_at: Optional[str] = None
    target_company_name: Optional[str] = None
    resend_count: int = 0


class ListInvitationsResponse(BaseModel):
    """Response for listing invitations."""
    invitations: List[InvitationInfo]
    total: int
    page: int
    page_size: int


class CreateInvitationResponse(BaseModel):
    """Response after creating an invitation."""
    success: bool
    invitation_id: str
    email: str
    expires_at: str
    email_sent: bool
    email_preview_mode: bool = False


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def check_is_platform_admin(user_id: str) -> tuple[bool, Optional[str]]:
    """
    Check if user is a platform admin.
    Returns (is_admin, role).

    Uses is_active=true to indicate active admin status.
    """
    try:
        supabase = get_supabase_service()
        result = supabase.table("platform_admins").select(
            "role"
        ).eq("user_id", user_id).eq("is_active", True).maybe_single().execute()

        if result and result.data:
            return True, result.data.get("role")
        return False, None
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to check admin status",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        return False, None


async def log_platform_audit(
    action: str,
    action_category: AuditActionCategory,
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_type: str = "user",
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    company_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    metadata: Optional[dict] = None,
    is_sensitive: bool = False
) -> Optional[str]:
    """
    Log an audit event to the platform_audit_logs table.

    Returns the log entry ID on success, None on failure.
    """
    try:
        supabase = get_supabase_service()

        log_data = {
            "action": action,
            "action_category": action_category,
            "actor_id": actor_id,
            "actor_email": actor_email,
            "actor_type": actor_type,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "resource_name": resource_name,
            "company_id": company_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "request_id": request_id,
            "old_values": old_values,
            "new_values": new_values,
            "metadata": metadata,
            "is_sensitive": is_sensitive,
        }

        # Remove None values
        log_data = {k: v for k, v in log_data.items() if v is not None}

        result = supabase.table("platform_audit_logs").insert(log_data).execute()

        if result.data and len(result.data) > 0:
            return result.data[0].get("id")
        return None

    except Exception as e:
        # Don't fail the main operation if audit logging fails
        log_app_event(
            "AUDIT: Failed to write audit log",
            level="ERROR",
            action=action,
            error=str(e)
        )
        return None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/check-access")
@limiter.limit("60/minute;300/hour")
async def check_admin_access(request: Request, user: dict = Depends(get_current_user)):
    """
    Check if the current user has platform admin access.
    Returns admin status and role.
    """
    user_id = user.get("id")

    is_admin, role = await check_is_platform_admin(user_id)

    log_app_event(
        "ADMIN: Access check",
        user_id=user_id,
        is_admin=is_admin,
        role=role
    )

    return AdminAccessResponse(is_admin=is_admin, role=role)


@router.get("/users")
@limiter.limit("30/minute;100/hour")
async def list_users(
    request: Request,
    user: dict = Depends(get_current_user),
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None
):
    """
    List all users on the platform (admin only).
    Supports pagination and search by email.
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Calculate offset
        offset = (page - 1) * page_size

        # Get soft-deleted user IDs to filter them out
        # Soft-deleted users have a record in user_deletions with permanently_deleted_at IS NULL
        deleted_users_result = supabase.table("user_deletions").select("user_id").is_(
            "permanently_deleted_at", "null"
        ).execute()
        soft_deleted_user_ids = {
            d["user_id"] for d in (deleted_users_result.data or [])
        }

        # Query auth.users via admin API
        # Note: This requires service role key
        response = supabase.auth.admin.list_users()

        # Handle both list response and paginated response object
        # (Supabase SDK version differences)
        if isinstance(response, list):
            all_users = response
        elif hasattr(response, 'users'):
            all_users = response.users
        else:
            all_users = list(response) if response else []

        # Helper to convert datetime to string
        def to_str(value):
            if value is None:
                return None
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            return str(value)

        # Filter by search and exclude soft-deleted users
        users_list = []
        for u in all_users:
            # Skip soft-deleted users - they should only appear in the "Deleted Users" section
            if u.id in soft_deleted_user_ids:
                continue

            user_data = {
                "id": u.id,
                "email": u.email or "",
                "created_at": to_str(u.created_at) or "",
                "last_sign_in_at": to_str(getattr(u, "last_sign_in_at", None)),
                "email_confirmed_at": to_str(getattr(u, "email_confirmed_at", None)),
                "user_metadata": getattr(u, "user_metadata", None),
            }

            # Apply search filter
            if search:
                if search.lower() not in user_data["email"].lower():
                    continue

            users_list.append(PlatformUser(**user_data))

        # Apply pagination
        total = len(users_list)
        paginated_users = users_list[offset:offset + page_size]

        log_app_event(
            "ADMIN: Listed users",
            user_id=user_id,
            total=total,
            page=page,
            search=search,
        )

        return ListUsersResponse(
            users=paginated_users,
            total=total,
            page=page,
            page_size=page_size
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list users",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list users")


# =============================================================================
# USER MANAGEMENT ENDPOINTS
# =============================================================================


class UserDetailResponse(BaseModel):
    """Detailed user info including related data."""
    id: str
    email: str
    created_at: str
    last_sign_in_at: Optional[str] = None
    email_confirmed_at: Optional[str] = None
    user_metadata: Optional[dict] = None
    is_suspended: bool = False
    companies: List[dict] = []
    conversation_count: int = 0


class UpdateUserRequest(BaseModel):
    """Request to update user status."""
    is_suspended: Optional[bool] = None
    suspend_reason: Optional[str] = None


class DeletedUser(BaseModel):
    """Deleted user information."""
    user_id: str
    email: Optional[str] = None  # May be anonymized
    deleted_at: datetime
    deleted_by: Optional[str] = None
    deletion_reason: Optional[str] = None
    restoration_deadline: datetime
    can_restore: bool
    days_until_anonymization: Optional[int] = None
    is_anonymized: bool


# IMPORTANT: This endpoint must be defined BEFORE /users/{target_user_id}
# to prevent FastAPI from treating "deleted" as a user_id parameter
@router.get("/users/deleted")
@limiter.limit("30/minute")
async def list_deleted_users(
    request: Request,
    user: dict = Depends(get_current_user),
    include_anonymized: bool = Query(False, description="Include anonymized users"),
):
    """
    List soft-deleted users (admin only).

    Returns users that have been soft-deleted and are pending restoration
    or anonymization.
    """
    admin_user_id = user.get("id")

    # Verify admin access
    is_admin, _ = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase_service()

        query = supabase.table("user_deletions").select("*")
        if not include_anonymized:
            query = query.is_("anonymized_at", "null")
        query = query.is_("permanently_deleted_at", "null")

        result = query.order("deleted_at", desc=True).execute()

        deleted_users = []
        now = datetime.utcnow()

        for record in (result.data or []):
            restoration_deadline = datetime.fromisoformat(
                record["restoration_deadline"].replace("Z", "+00:00")
            ).replace(tzinfo=None)
            can_restore = restoration_deadline > now and record.get("anonymized_at") is None

            days_until = None
            if can_restore:
                days_until = (restoration_deadline - now).days

            # Try to get email from metadata or auth
            email = None
            if record.get("metadata", {}).get("original_email"):
                email = record["metadata"]["original_email"]
            elif not record.get("anonymized_at"):
                try:
                    user_resp = supabase.auth.admin.get_user_by_id(record["user_id"])
                    if user_resp.user:
                        email = user_resp.user.email
                except Exception as e:
                    logger.warning("Failed to fetch email for deleted user %s: %s", record["user_id"], e)

            deleted_users.append(DeletedUser(
                user_id=record["user_id"],
                email=email,
                deleted_at=record["deleted_at"],
                deleted_by=record.get("deleted_by"),
                deletion_reason=record.get("deletion_reason"),
                restoration_deadline=record["restoration_deadline"],
                can_restore=can_restore,
                days_until_anonymization=days_until,
                is_anonymized=record.get("anonymized_at") is not None,
            ))

        log_app_event(
            "ADMIN: Listed deleted users",
            user_id=admin_user_id,
            count=len(deleted_users),
        )

        return {
            "deleted_users": [u.model_dump() for u in deleted_users],
            "total": len(deleted_users),
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list deleted users",
            level="ERROR",
            user_id=admin_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list deleted users")


@router.get("/users/{target_user_id}")
@limiter.limit("30/minute;100/hour")
async def get_user_details(
    request: Request,
    target_user_id: str = Path(..., description="User ID to get details for"),
    user: dict = Depends(get_current_user),
):
    """
    Get detailed information about a specific user (admin only).
    Includes their companies, conversation count, and suspension status.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get user from auth
        try:
            user_response = supabase.auth.admin.get_user_by_id(target_user_id)
            target_user = user_response.user
        except Exception:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        if not target_user:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        # Helper to convert datetime to string
        def to_str(value):
            if value is None:
                return None
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            return str(value)

        # Get user's companies
        companies_result = supabase.table("companies").select(
            "id, name, created_at"
        ).eq("user_id", target_user_id).execute()
        companies = companies_result.data or []

        # Get conversation count
        conv_result = supabase.table("conversations").select(
            "id", count="exact"
        ).eq("user_id", target_user_id).execute()
        conversation_count = conv_result.count or 0

        # Check if user is suspended (banned_until in user_metadata)
        user_metadata = getattr(target_user, "user_metadata", {}) or {}
        is_suspended = user_metadata.get("is_suspended", False)

        log_app_event(
            "ADMIN: Viewed user details",
            user_id=admin_user_id,
            target_user_id=target_user_id,
        )

        return UserDetailResponse(
            id=target_user.id,
            email=target_user.email or "",
            created_at=to_str(target_user.created_at) or "",
            last_sign_in_at=to_str(getattr(target_user, "last_sign_in_at", None)),
            email_confirmed_at=to_str(getattr(target_user, "email_confirmed_at", None)),
            user_metadata=user_metadata,
            is_suspended=is_suspended,
            companies=companies,
            conversation_count=conversation_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to get user details",
            level="ERROR",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to get user details")


@router.patch("/users/{target_user_id}")
@limiter.limit("20/minute")
async def update_user(
    request: Request,
    update_data: UpdateUserRequest,
    target_user_id: str = Path(..., description="User ID to update"),
    user: dict = Depends(get_current_user),
):
    """
    Update a user's status (admin only).
    Currently supports suspending/unsuspending users.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    # Prevent self-suspension
    if target_user_id == admin_user_id:
        raise HTTPException(status_code=400, detail=t("errors.cannot_modify_own_account", locale))

    try:
        supabase = get_supabase_service()

        # Get current user
        try:
            user_response = supabase.auth.admin.get_user_by_id(target_user_id)
            target_user = user_response.user
        except Exception:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        if not target_user:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        # Check if target is also an admin (prevent suspending admins unless super_admin)
        target_is_admin, target_role = await check_is_platform_admin(target_user_id)
        if target_is_admin and role != "super_admin":
            raise HTTPException(
                status_code=403,
                detail=t("errors.only_super_admin_modify_admin", locale)
            )

        # Update user metadata for suspension
        if update_data.is_suspended is not None:
            current_metadata = getattr(target_user, "user_metadata", {}) or {}
            current_metadata["is_suspended"] = update_data.is_suspended
            current_metadata["suspended_at"] = datetime.utcnow().isoformat() if update_data.is_suspended else None
            current_metadata["suspended_by"] = admin_user_id if update_data.is_suspended else None
            # Store suspend/unsuspend reason
            if update_data.suspend_reason:
                current_metadata["suspend_reason"] = update_data.suspend_reason
            elif not update_data.is_suspended:
                # Clear reason when unsuspending (but keep historical record in audit log)
                current_metadata.pop("suspend_reason", None)

            # Update user via admin API
            supabase.auth.admin.update_user_by_id(
                target_user_id,
                {"user_metadata": current_metadata}
            )

            action = "suspend_user" if update_data.is_suspended else "unsuspend_user"

            # Log audit event with reason
            client_ip = request.client.host if request.client else None
            audit_details = {}
            if update_data.suspend_reason:
                audit_details["reason"] = update_data.suspend_reason

            await log_platform_audit(
                action=action,
                action_category="user",
                actor_id=admin_user_id,
                actor_email=admin_email,
                actor_type="admin",
                resource_type="user",
                resource_id=target_user_id,
                resource_name=target_user.email,
                ip_address=client_ip,
                metadata=audit_details if audit_details else None,
            )

            log_app_event(
                f"ADMIN: {'Suspended' if update_data.is_suspended else 'Unsuspended'} user",
                user_id=admin_user_id,
                target_user_id=target_user_id,
                target_email=target_user.email,
                reason=update_data.suspend_reason,
            )

        return {
            "success": True,
            "message": f"User {'suspended' if update_data.is_suspended else 'unsuspended'} successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to update user",
            level="ERROR",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to update user")


@router.delete("/users/{target_user_id}")
@limiter.limit("10/minute")
async def delete_user(
    request: Request,
    target_user_id: str = Path(..., description="User ID to delete"),
    user: dict = Depends(get_current_user),
    confirm: bool = Query(False, description="Confirm deletion"),
    permanent: bool = Query(False, description="Permanently delete (super_admin only, skips soft delete)"),
    reason: Optional[str] = Query(None, description="Reason for deletion (for audit trail)"),
):
    """
    Soft-delete a user (admin only).

    By default, this performs a SOFT DELETE:
    - User is banned and cannot log in
    - User data is hidden but preserved
    - User can be restored within 30 days
    - After 30 days, PII is anonymized but audit trail preserved

    With permanent=true (super_admin only):
    - Immediately and permanently deletes all user data
    - Cannot be undone
    - Use only for GDPR "right to erasure" requests

    Requires confirm=true query parameter as a safety measure.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    # Require confirmation
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail=t("errors.deletion_requires_confirmation", locale)
        )

    # Permanent deletion requires super_admin
    if permanent and role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Only super admins can permanently delete users"
        )

    # Prevent self-deletion
    if target_user_id == admin_user_id:
        raise HTTPException(status_code=400, detail=t("errors.cannot_delete_own_account", locale))

    try:
        supabase = get_supabase_service()

        # Get user before deletion (for logging)
        try:
            user_response = supabase.auth.admin.get_user_by_id(target_user_id)
            target_user = user_response.user
        except Exception:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        if not target_user:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        target_email = target_user.email

        # Check if target is also an admin (only super_admin can delete admins)
        target_is_admin, target_role = await check_is_platform_admin(target_user_id)
        if target_is_admin and role != "super_admin":
            raise HTTPException(
                status_code=403,
                detail=t("errors.only_super_admin_delete_admin", locale)
            )

        # Check if already soft-deleted
        existing_deletion = supabase.table("user_deletions").select("*").eq(
            "user_id", target_user_id
        ).execute()
        is_already_deleted = bool(existing_deletion.data)

        # Get counts for audit
        companies_result = supabase.table("companies").select(
            "id", count="exact"
        ).eq("user_id", target_user_id).execute()
        company_count = companies_result.count or 0

        conv_result = supabase.table("conversations").select(
            "id", count="exact"
        ).eq("user_id", target_user_id).execute()
        conv_count = conv_result.count or 0

        client_ip = request.client.host if request.client else None

        if permanent:
            # =================================================================
            # PERMANENT DELETE (super_admin only, for GDPR erasure requests)
            # =================================================================
            log_app_event(
                "ADMIN: Starting PERMANENT deletion",
                user_id=admin_user_id,
                target_user_id=target_user_id,
                reason=reason,
            )

            # Delete user's data in order (respecting foreign key constraints)
            # 1. Delete knowledge entries
            supabase.table("knowledge_entries").delete().eq("user_id", target_user_id).execute()

            # 2. Get user's companies
            user_companies = supabase.table("companies").select("id").eq("user_id", target_user_id).execute()
            company_ids = [c["id"] for c in (user_companies.data or [])]

            if company_ids:
                # 3. Delete messages for user's conversations
                user_convs = supabase.table("conversations").select("id").eq("user_id", target_user_id).execute()
                conv_ids = [c["id"] for c in (user_convs.data or [])]
                if conv_ids:
                    for conv_id in conv_ids:
                        supabase.table("messages").delete().eq("conversation_id", conv_id).execute()

                # 4. Delete conversations
                supabase.table("conversations").delete().eq("user_id", target_user_id).execute()

                # 5. Delete company-related data
                for company_id in company_ids:
                    supabase.table("departments").delete().eq("company_id", company_id).execute()
                    supabase.table("roles").delete().eq("company_id", company_id).execute()
                    supabase.table("org_documents").delete().eq("company_id", company_id).execute()

                # 6. Delete companies
                supabase.table("companies").delete().eq("user_id", target_user_id).execute()

            # 7. Remove from platform_admins if applicable
            if target_is_admin:
                supabase.table("platform_admins").delete().eq("user_id", target_user_id).execute()

            # 8. Remove deletion record if exists
            if is_already_deleted:
                supabase.table("user_deletions").delete().eq("user_id", target_user_id).execute()

            # 9. Finally, delete the auth user
            supabase.auth.admin.delete_user(target_user_id)

            await log_platform_audit(
                action="permanent_delete_user",
                action_category="user",
                actor_id=admin_user_id,
                actor_email=admin_email,
                actor_type="admin",
                resource_type="user",
                resource_id=target_user_id,
                resource_name=target_email,
                ip_address=client_ip,
                metadata={
                    "deleted_companies": company_count,
                    "deleted_conversations": conv_count,
                    "was_admin": target_is_admin,
                    "reason": reason,
                    "type": "permanent",
                },
                is_sensitive=True,
            )

            return {
                "success": True,
                "message": f"User {target_email} has been PERMANENTLY deleted",
                "type": "permanent",
                "deleted": {
                    "companies": company_count,
                    "conversations": conv_count,
                }
            }
        else:
            # =================================================================
            # SOFT DELETE (default - user can be restored within 30 days)
            # =================================================================
            import hashlib
            email_hash = hashlib.sha256(target_email.encode()).hexdigest()

            # Create/update deletion record
            deletion_data = {
                "user_id": target_user_id,
                "email_hash": email_hash,
                "deleted_by": admin_user_id,
                "deletion_reason": reason,
                "metadata": {
                    "original_email": target_email,
                    "company_count": company_count,
                    "conversation_count": conv_count,
                    "was_admin": target_is_admin,
                }
            }

            if is_already_deleted:
                # Update existing record (re-deletion resets the timer)
                supabase.table("user_deletions").update({
                    **deletion_data,
                    "deleted_at": "now()",
                    "restoration_deadline": "(now() + interval '30 days')",
                    "anonymized_at": None,
                }).eq("user_id", target_user_id).execute()
            else:
                supabase.table("user_deletions").insert(deletion_data).execute()

            # Ban the user in Supabase Auth (prevents login but keeps data)
            try:
                # Update user's banned status
                supabase.auth.admin.update_user_by_id(
                    target_user_id,
                    {"ban_duration": "876000h"}  # ~100 years (effectively permanent ban)
                )
            except Exception as ban_error:
                log_app_event(
                    "ADMIN: Failed to ban user during soft delete",
                    level="WARNING",
                    target_user_id=target_user_id,
                    error=str(ban_error)
                )

            await log_platform_audit(
                action="soft_delete_user",
                action_category="user",
                actor_id=admin_user_id,
                actor_email=admin_email,
                actor_type="admin",
                resource_type="user",
                resource_id=target_user_id,
                resource_name=target_email,
                ip_address=client_ip,
                metadata={
                    "company_count": company_count,
                    "conversation_count": conv_count,
                    "was_admin": target_is_admin,
                    "reason": reason,
                    "type": "soft_delete",
                    "restoration_deadline": "30 days",
                },
                is_sensitive=True,
            )

            log_app_event(
                "ADMIN: Soft-deleted user",
                user_id=admin_user_id,
                target_user_id=target_user_id,
                target_email=target_email,
            )

            return {
                "success": True,
                "message": f"User {target_email} has been deleted. They can be restored within 30 days.",
                "type": "soft_delete",
                "restoration_deadline_days": 30,
                "data_preserved": {
                    "companies": company_count,
                    "conversations": conv_count,
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to delete user",
            level="ERROR",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to delete user")


# =============================================================================
# USER RESTORATION
# =============================================================================

@router.post("/users/{target_user_id}/restore")
@limiter.limit("10/minute")
async def restore_user(
    request: Request,
    target_user_id: str = Path(..., description="User ID to restore"),
    user: dict = Depends(get_current_user),
):
    """
    Restore a soft-deleted user (admin only).

    Can only restore users within the 30-day restoration window
    and before anonymization.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")

    # Verify admin access
    is_admin, _ = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase_service()

        # Get deletion record
        deletion_result = supabase.table("user_deletions").select("*").eq(
            "user_id", target_user_id
        ).execute()

        if not deletion_result.data:
            raise HTTPException(status_code=404, detail="User deletion record not found")

        deletion = deletion_result.data[0]

        # Check if can restore
        if deletion.get("anonymized_at"):
            raise HTTPException(
                status_code=400,
                detail="User has been anonymized and cannot be restored"
            )

        if deletion.get("permanently_deleted_at"):
            raise HTTPException(
                status_code=400,
                detail="User has been permanently deleted"
            )

        restoration_deadline = datetime.fromisoformat(
            deletion["restoration_deadline"].replace("Z", "+00:00")
        ).replace(tzinfo=None)

        if datetime.utcnow() > restoration_deadline:
            raise HTTPException(
                status_code=400,
                detail="Restoration deadline has passed"
            )

        # Get user info
        target_email = deletion.get("metadata", {}).get("original_email", "unknown")

        # Unban the user in Supabase Auth
        try:
            supabase.auth.admin.update_user_by_id(
                target_user_id,
                {"ban_duration": "none"}
            )
        except Exception as unban_error:
            log_app_event(
                "ADMIN: Failed to unban user during restore",
                level="WARNING",
                target_user_id=target_user_id,
                error=str(unban_error)
            )

        # Remove deletion record
        supabase.table("user_deletions").delete().eq("user_id", target_user_id).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="restore_user",
            action_category="user",
            actor_id=admin_user_id,
            actor_email=admin_email,
            actor_type="admin",
            resource_type="user",
            resource_id=target_user_id,
            resource_name=target_email,
            ip_address=client_ip,
            metadata={
                "days_remaining": (restoration_deadline - datetime.utcnow()).days,
            },
            is_sensitive=True,
        )

        log_app_event(
            "ADMIN: Restored deleted user",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            target_email=target_email,
        )

        return {
            "success": True,
            "message": f"User {target_email} has been restored",
            "user_id": target_user_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to restore user",
            level="ERROR",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to restore user")


@router.get("/admins")
@limiter.limit("30/minute;100/hour")
async def list_admins(request: Request, user: dict = Depends(get_current_user)):
    """
    List all platform admins (admin only).
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get all active admins (is_active = true)
        result = supabase.table("platform_admins").select(
            "user_id, role, created_at"
        ).eq("is_active", True).execute()

        admins = result.data or []

        # Enrich with email from auth.users
        enriched_admins = []
        for admin in admins:
            try:
                user_response = supabase.auth.admin.get_user_by_id(admin["user_id"])
                email = user_response.user.email if user_response.user else "Unknown"
            except Exception:
                email = "Unknown"

            enriched_admins.append(AdminUser(
                id=admin["user_id"],
                email=email,
                role=admin["role"],
                created_at=admin["created_at"] or "",
            ))

        log_app_event(
            "ADMIN: Listed admins",
            user_id=user_id,
            count=len(enriched_admins)
        )

        return {"admins": enriched_admins}

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list admins",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list admins")


@router.get("/companies")
@limiter.limit("30/minute;100/hour")
async def list_companies(
    request: Request,
    user: dict = Depends(get_current_user),
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None
):
    """
    List all companies on the platform (admin only).
    Includes user count and conversation count for each.
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get all companies
        query = supabase.table("companies").select("id, name, created_at, user_id")

        if search:
            query = query.ilike("name", f"%{search}%")

        result = query.order("created_at", desc=True).execute()
        all_companies = result.data or []

        # Enrich with counts
        companies_list = []
        for company in all_companies:
            # Get conversation count
            conv_result = supabase.table("conversations").select(
                "id", count="exact"
            ).eq("company_id", company["id"]).execute()
            conv_count = conv_result.count or 0

            # Get owner email
            owner_email = None
            if company.get("user_id"):
                try:
                    user_response = supabase.auth.admin.get_user_by_id(company["user_id"])
                    owner_email = user_response.user.email if user_response.user else None
                except Exception as e:
                    logger.warning("Failed to fetch owner email for company %s: %s", company["id"], e)

            companies_list.append(CompanyInfo(
                id=company["id"],
                name=company["name"],
                created_at=company["created_at"] or "",
                user_count=1,  # For now, 1 user per company (owner)
                conversation_count=conv_count,
                owner_email=owner_email,
            ))

        # Apply pagination
        total = len(companies_list)
        offset = (page - 1) * page_size
        paginated = companies_list[offset:offset + page_size]

        log_app_event(
            "ADMIN: Listed companies",
            user_id=user_id,
            total=total,
            page=page
        )

        return ListCompaniesResponse(
            companies=paginated,
            total=total,
            page=page,
            page_size=page_size
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list companies",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list companies")


@router.get("/stats")
@limiter.limit("60/minute;300/hour")
async def get_platform_stats(request: Request, user: dict = Depends(get_current_user)):
    """
    Get platform-wide statistics (admin only).
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get total users from auth
        response = supabase.auth.admin.list_users()
        # Handle both list response and paginated response object
        if isinstance(response, list):
            all_users = response
        elif hasattr(response, 'users'):
            all_users = response.users
        else:
            all_users = list(response) if response else []
        total_users = len(all_users)

        # Get total companies
        companies_result = supabase.table("companies").select("id", count="exact").execute()
        total_companies = companies_result.count or 0

        # Get total conversations
        conv_result = supabase.table("conversations").select("id", count="exact").execute()
        total_conversations = conv_result.count or 0

        # Get total messages
        msg_result = supabase.table("messages").select("id", count="exact").execute()
        total_messages = msg_result.count or 0

        # Active users (approximation - users who signed in recently)
        # Note: This is a simplified version; real implementation would track activity
        active_24h = min(total_users, 5)  # Placeholder
        active_7d = min(total_users, 10)  # Placeholder

        log_app_event(
            "ADMIN: Fetched platform stats",
            user_id=user_id
        )

        return PlatformStats(
            total_users=total_users,
            total_companies=total_companies,
            total_conversations=total_conversations,
            total_messages=total_messages,
            active_users_24h=active_24h,
            active_users_7d=active_7d
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to get platform stats",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to get platform stats")


@router.get("/audit")
@limiter.limit("30/minute;100/hour")
async def list_audit_logs(
    request: Request,
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action_category: Optional[str] = Query(None),
    actor_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    company_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, description="ISO format date"),
    end_date: Optional[str] = Query(None, description="ISO format date"),
    search: Optional[str] = Query(None, description="Search in action or resource_name"),
):
    """
    List platform audit logs with filtering (admin only).

    Filters:
    - action_category: auth, user, company, admin, data, api, billing, security
    - actor_type: user, admin, system, api
    - resource_type: user, company, admin, api_key, etc.
    - company_id: Filter by specific company
    - start_date/end_date: Date range filter (ISO format)
    - search: Text search in action or resource_name
    """
    user_id = user.get("id")
    user_email = user.get("email")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()
        if supabase is None:
            raise HTTPException(
                status_code=500,
                detail=t("errors.database_service_unavailable", locale)
            )

        # Build query
        query = supabase.table("platform_audit_logs").select(
            "id, timestamp, actor_id, actor_email, actor_type, action, action_category, "
            "resource_type, resource_id, resource_name, company_id, ip_address, metadata",
            count="exact"
        )

        # Apply filters
        if action_category:
            query = query.eq("action_category", action_category)

        if actor_type:
            query = query.eq("actor_type", actor_type)

        if resource_type:
            query = query.eq("resource_type", resource_type)

        if company_id:
            query = query.eq("company_id", company_id)

        if start_date:
            query = query.gte("timestamp", start_date)

        if end_date:
            # Add one day to include the end date fully
            query = query.lte("timestamp", end_date + "T23:59:59Z")

        if search:
            # Search in action or resource_name (escape special SQL LIKE characters)
            escaped_search = escape_sql_like_pattern(search)
            query = query.or_(f"action.ilike.%{escaped_search}%,resource_name.ilike.%{escaped_search}%")

        # Order and paginate
        offset = (page - 1) * page_size
        query = query.order("timestamp", desc=True).range(offset, offset + page_size - 1)

        result = query.execute()
        logs_data = result.data or []
        total = result.count or 0

        # Convert to response models
        logs = []
        for log in logs_data:
            logs.append(AuditLogEntry(
                id=log["id"],
                timestamp=log["timestamp"],
                actor_id=log.get("actor_id"),
                actor_email=log.get("actor_email"),
                actor_type=log.get("actor_type", "user"),
                action=log["action"],
                action_category=log["action_category"],
                resource_type=log.get("resource_type"),
                resource_id=log.get("resource_id"),
                resource_name=log.get("resource_name"),
                company_id=log.get("company_id"),
                ip_address=str(log["ip_address"]) if log.get("ip_address") else None,
                metadata=log.get("metadata"),
            ))

        return ListAuditLogsResponse(
            logs=logs,
            total=total,
            page=page,
            page_size=page_size
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list audit logs",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list audit logs")


@router.get("/audit/categories")
@limiter.limit("60/minute")
async def get_audit_categories(request: Request, user: dict = Depends(get_current_user)):
    """
    Get available audit log categories and action types (admin only).
    Useful for building filter dropdowns.
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    return {
        "action_categories": [
            {"value": "auth", "label": "Authentication"},
            {"value": "user", "label": "User Management"},
            {"value": "company", "label": "Company Management"},
            {"value": "admin", "label": "Admin Actions"},
            {"value": "data", "label": "Data Operations"},
            {"value": "api", "label": "API Operations"},
            {"value": "billing", "label": "Billing"},
            {"value": "security", "label": "Security Events"},
        ],
        "actor_types": [
            {"value": "user", "label": "User"},
            {"value": "admin", "label": "Platform Admin"},
            {"value": "system", "label": "System"},
            {"value": "api", "label": "API"},
        ],
        "resource_types": [
            {"value": "user", "label": "User"},
            {"value": "company", "label": "Company"},
            {"value": "admin", "label": "Admin"},
            {"value": "api_key", "label": "API Key"},
            {"value": "conversation", "label": "Conversation"},
            {"value": "setting", "label": "Setting"},
        ]
    }


@router.post("/audit/export")
@limiter.limit("5/minute")
async def export_audit_logs(
    request: Request,
    user: dict = Depends(get_current_user),
    action_category: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
):
    """
    Export audit logs to JSON (admin only).
    Limited to 10,000 records per export.
    """
    user_id = user.get("id")
    user_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access - only super_admin can export
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin or role != "super_admin":
        raise HTTPException(status_code=403, detail=t("errors.super_admin_access_required", locale))

    try:
        supabase = get_supabase_service()
        if supabase is None:
            raise HTTPException(
                status_code=500,
                detail=t("errors.database_service_unavailable", locale)
            )

        # Build query
        query = supabase.table("platform_audit_logs").select("*")

        if action_category:
            query = query.eq("action_category", action_category)

        if start_date:
            query = query.gte("timestamp", start_date)

        if end_date:
            query = query.lte("timestamp", end_date + "T23:59:59Z")

        query = query.order("timestamp", desc=True).limit(limit)

        result = query.execute()
        logs = result.data or []

        # Log the export action
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="export_audit_logs",
            action_category="data",
            actor_id=user_id,
            actor_email=user_email,
            actor_type="admin",
            ip_address=client_ip,
            metadata={
                "record_count": len(logs),
                "filters": {
                    "action_category": action_category,
                    "start_date": start_date,
                    "end_date": end_date,
                }
            },
            is_sensitive=True
        )

        return {
            "success": True,
            "count": len(logs),
            "exported_at": datetime.utcnow().isoformat(),
            "logs": logs
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to export audit logs",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to export audit logs")


# =============================================================================
# INVITATION ENDPOINTS
# =============================================================================

@router.post("/invitations")
@limiter.limit("10/minute;50/hour")
async def create_invitation(
    request: Request,
    invitation_data: CreateInvitationRequest,
    user: dict = Depends(get_current_user),
):
    """
    Create and send a platform invitation (admin only).

    The invited user will receive an email with a link to sign up.
    """
    user_id = user.get("id")
    user_email = user.get("email")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Check if user already exists (paginate to handle >50 users)
        try:
            target_email = invitation_data.email.lower()
            page = 1
            per_page = 1000  # Use larger page size to minimize API calls
            user_found = False

            while not user_found:
                existing_users = supabase.auth.admin.list_users(page=page, per_page=per_page)
                if isinstance(existing_users, list):
                    all_users = existing_users
                elif hasattr(existing_users, 'users'):
                    all_users = existing_users.users
                else:
                    all_users = list(existing_users) if existing_users else []

                if not all_users:
                    break  # No more users to check

                for u in all_users:
                    if u.email and u.email.lower() == target_email:
                        raise HTTPException(
                            status_code=400,
                            detail=t("errors.user_already_exists", locale, email=invitation_data.email)
                        )

                # If we got fewer users than per_page, we've reached the end
                if len(all_users) < per_page:
                    break
                page += 1
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Failed to check existing users for duplicate email %s: %s", invitation_data.email, e)

        # Check for existing pending invitation
        existing = supabase.table("platform_invitations").select(
            "id, status"
        ).eq("email", invitation_data.email.lower()).eq("status", "pending").maybe_single().execute()

        if existing and existing.data:
            raise HTTPException(
                status_code=400,
                detail=t("errors.pending_invitation_exists", locale, email=invitation_data.email)
            )

        # Generate token and expiry
        invitation_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=7)

        # Get company name if target company specified
        target_company_name = None
        if invitation_data.target_company_id:
            company_result = supabase.table("companies").select(
                "name"
            ).eq("id", invitation_data.target_company_id).maybe_single().execute()
            if company_result and company_result.data:
                target_company_name = company_result.data.get("name")

        # Create invitation record
        insert_data = {
            "email": invitation_data.email.lower(),
            "name": invitation_data.name,
            "token": invitation_token,
            "invited_by": user_id,
            "invited_by_email": user_email,
            "expires_at": expires_at.isoformat(),
            "notes": invitation_data.notes,
            "target_company_id": invitation_data.target_company_id,
            "target_company_role": invitation_data.target_company_role or "member",
        }

        result = supabase.table("platform_invitations").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail=t("errors.invitation_create_failed", locale))

        invitation_id = result.data[0]["id"]

        # Send invitation email
        inviter_name = user_email.split("@")[0] if user_email else "An admin"
        email_result = await send_invitation_email(
            invitee_email=invitation_data.email,
            inviter_name=inviter_name,
            invitation_token=invitation_token,
            expires_at=expires_at.strftime("%B %d, %Y"),
        )

        # Update email sent timestamp
        if email_result.get("success"):
            supabase.table("platform_invitations").update({
                "email_sent_at": datetime.utcnow().isoformat(),
                "email_message_id": email_result.get("message_id"),
            }).eq("id", invitation_id).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="create_invitation",
            action_category="user",
            actor_id=user_id,
            actor_email=user_email,
            actor_type="admin",
            resource_type="invitation",
            resource_id=invitation_id,
            resource_name=invitation_data.email,
            ip_address=client_ip,
            metadata={
                "target_company_id": invitation_data.target_company_id,
                "target_company_name": target_company_name,
            }
        )

        log_app_event(
            "ADMIN: Created invitation",
            user_id=user_id,
            invitation_id=invitation_id,
            invitee_email=invitation_data.email,
            email_sent=email_result.get("success", False),
        )

        return CreateInvitationResponse(
            success=True,
            invitation_id=invitation_id,
            email=invitation_data.email,
            expires_at=expires_at.isoformat(),
            email_sent=email_result.get("success", False),
            email_preview_mode=email_result.get("preview_mode", False),
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to create invitation",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to create invitation")


@router.get("/invitations")
@limiter.limit("30/minute;100/hour")
async def list_invitations(
    request: Request,
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by email"),
):
    """
    List platform invitations (admin only).
    """
    user_id = user.get("id")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Build query
        query = supabase.table("platform_invitations").select(
            "id, email, name, status, invited_by_email, created_at, expires_at, "
            "accepted_at, target_company_id, resend_count",
            count="exact"
        )

        # Apply filters
        if status:
            query = query.eq("status", status)

        if search:
            query = query.ilike("email", f"%{search}%")

        # Order and paginate
        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)

        result = query.execute()
        invitations_data = result.data or []
        total = result.count or 0

        # Enrich with company names
        invitations = []
        for inv in invitations_data:
            target_company_name = None
            if inv.get("target_company_id"):
                try:
                    company_result = supabase.table("companies").select(
                        "name"
                    ).eq("id", inv["target_company_id"]).maybe_single().execute()
                    if company_result and company_result.data:
                        target_company_name = company_result.data.get("name")
                except Exception as e:
                    logger.warning("Failed to fetch company name for invitation target_company_id %s: %s", inv["target_company_id"], e)

            invitations.append(InvitationInfo(
                id=inv["id"],
                email=inv["email"],
                name=inv.get("name"),
                status=inv["status"],
                invited_by_email=inv.get("invited_by_email"),
                created_at=inv["created_at"] or "",
                expires_at=inv["expires_at"] or "",
                accepted_at=inv.get("accepted_at"),
                target_company_name=target_company_name,
                resend_count=inv.get("resend_count", 0),
            ))

        log_app_event(
            "ADMIN: Listed invitations",
            user_id=user_id,
            total=total,
            page=page
        )

        return ListInvitationsResponse(
            invitations=invitations,
            total=total,
            page=page,
            page_size=page_size
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list invitations",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list invitations")


@router.delete("/invitations/{invitation_id}")
@limiter.limit("20/minute")
async def cancel_invitation(
    request: Request,
    invitation_id: str = Path(..., description="Invitation ID to cancel/delete"),
    user: dict = Depends(get_current_user),
):
    """
    Delete a pending invitation (admin only).

    This PERMANENTLY deletes the invitation record since invited users
    who haven't accepted have no data to preserve. To re-invite them,
    you would need to create a new invitation.
    """
    user_id = user.get("id")
    user_email = user.get("email")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get invitation
        inv_result = supabase.table("platform_invitations").select(
            "id, email, status"
        ).eq("id", invitation_id).maybe_single().execute()

        if not inv_result or not inv_result.data:
            raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", locale))

        # Only allow deletion of pending invitations
        if inv_result.data["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=t("errors.cannot_cancel_invitation", locale, status=inv_result.data['status'])
            )

        invitee_email = inv_result.data["email"]

        # HARD DELETE the invitation - invited users have no data to preserve
        supabase.table("platform_invitations").delete().eq("id", invitation_id).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="delete_invitation",
            action_category="user",
            actor_id=user_id,
            actor_email=user_email,
            actor_type="admin",
            resource_type="invitation",
            resource_id=invitation_id,
            resource_name=invitee_email,
            ip_address=client_ip,
        )

        log_app_event(
            "ADMIN: Deleted invitation",
            user_id=user_id,
            invitation_id=invitation_id,
            invitee_email=invitee_email,
        )

        return {"success": True, "message": "Invitation deleted"}

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to cancel invitation",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to cancel invitation")


@router.post("/invitations/{invitation_id}/resend")
@limiter.limit("5/minute;20/hour")
async def resend_invitation(
    request: Request,
    invitation_id: str = Path(..., description="Invitation ID to resend"),
    user: dict = Depends(get_current_user),
):
    """
    Resend invitation email (admin only).
    Also extends the expiration by 7 days.
    """
    user_id = user.get("id")
    user_email = user.get("email")

    # Verify admin access
    locale = get_locale_from_request(request)
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Get invitation
        inv_result = supabase.table("platform_invitations").select(
            "id, email, name, token, status, resend_count"
        ).eq("id", invitation_id).maybe_single().execute()

        if not inv_result or not inv_result.data:
            raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", locale))

        if inv_result.data["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=t("errors.cannot_resend_invitation", locale, status=inv_result.data['status'])
            )

        # Extend expiration
        new_expires_at = datetime.utcnow() + timedelta(days=7)

        # Send email
        inviter_name = user_email.split("@")[0] if user_email else "An admin"
        email_result = await send_invitation_email(
            invitee_email=inv_result.data["email"],
            inviter_name=inviter_name,
            invitation_token=inv_result.data["token"],
            expires_at=new_expires_at.strftime("%B %d, %Y"),
        )

        # Update invitation record
        supabase.table("platform_invitations").update({
            "expires_at": new_expires_at.isoformat(),
            "resend_count": (inv_result.data.get("resend_count") or 0) + 1,
            "last_resent_at": datetime.utcnow().isoformat(),
            "email_sent_at": datetime.utcnow().isoformat() if email_result.get("success") else None,
            "email_message_id": email_result.get("message_id"),
        }).eq("id", invitation_id).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="resend_invitation",
            action_category="user",
            actor_id=user_id,
            actor_email=user_email,
            actor_type="admin",
            resource_type="invitation",
            resource_id=invitation_id,
            resource_name=inv_result.data["email"],
            ip_address=client_ip,
            metadata={
                "resend_count": (inv_result.data.get("resend_count") or 0) + 1,
            }
        )

        log_app_event(
            "ADMIN: Resent invitation",
            user_id=user_id,
            invitation_id=invitation_id,
            invitee_email=inv_result.data["email"],
            email_sent=email_result.get("success", False),
        )

        return {
            "success": True,
            "message": "Invitation resent",
            "new_expires_at": new_expires_at.isoformat(),
            "email_sent": email_result.get("success", False),
            "email_preview_mode": email_result.get("preview_mode", False),
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to resend invitation",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to resend invitation")


@router.delete("/invitations/{invitation_id}/permanent")
@limiter.limit("20/minute;100/hour")
async def delete_invitation_permanent(
    request: Request,
    invitation_id: str = Path(..., description="Invitation ID to permanently delete"),
    user: dict = Depends(get_current_user),
):
    """
    Permanently delete a cancelled or expired invitation (admin only).
    This removes the invitation record from the database entirely.
    Only cancelled or expired invitations can be permanently deleted.
    """
    user_id = user.get("id")
    user_email = user.get("email")

    # Verify admin access
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase_service()

        # Get invitation to verify status
        inv_result = supabase.table("platform_invitations").select(
            "id, email, status"
        ).eq("id", invitation_id).maybe_single().execute()

        if not inv_result or not inv_result.data:
            raise HTTPException(status_code=404, detail="Invitation not found")

        # Only allow deletion of cancelled or expired invitations
        if inv_result.data["status"] not in ("cancelled", "expired", "revoked"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete invitation with status: {inv_result.data['status']}. Only cancelled, expired, or revoked invitations can be deleted."
            )

        invitee_email = inv_result.data["email"]

        # Delete the invitation record
        supabase.table("platform_invitations").delete().eq("id", invitation_id).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="delete_invitation_permanent",
            action_category="user",
            actor_id=user_id,
            actor_email=user_email,
            actor_type="admin",
            resource_type="invitation",
            resource_id=invitation_id,
            resource_name=invitee_email,
            ip_address=client_ip,
            metadata={
                "previous_status": inv_result.data["status"],
            }
        )

        log_app_event(
            "ADMIN: Permanently deleted invitation",
            user_id=user_id,
            invitation_id=invitation_id,
            invitee_email=invitee_email,
        )

        return {
            "success": True,
            "message": f"Invitation for {invitee_email} has been permanently deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to permanently delete invitation",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to delete invitation")


# =============================================================================
# IMPERSONATION ENDPOINTS
# =============================================================================

# Configuration for impersonation sessions
IMPERSONATION_MAX_DURATION_MINUTES = 30
IMPERSONATION_TOKEN_PREFIX = "imp_"


class StartImpersonationRequest(BaseModel):
    """Request to start impersonating a user."""
    reason: str = Field(..., min_length=5, max_length=500, description="Reason for impersonation (required for audit)")


class ImpersonationSession(BaseModel):
    """Active impersonation session info."""
    session_id: str
    admin_id: str
    admin_email: str
    target_user_id: str
    target_user_email: str
    started_at: str
    expires_at: str
    reason: str


class StartImpersonationResponse(BaseModel):
    """Response when starting impersonation."""
    success: bool
    session: ImpersonationSession


class ImpersonationStatusResponse(BaseModel):
    """Response for impersonation status check."""
    is_impersonating: bool
    session: Optional[ImpersonationSession] = None


@router.post("/users/{target_user_id}/impersonate")
@limiter.limit("10/minute;30/hour")
async def start_impersonation(
    request: Request,
    impersonation_request: StartImpersonationRequest,
    target_user_id: str = Path(..., description="User ID to impersonate"),
    user: dict = Depends(get_current_user),
):
    """
    Start an impersonation session to view the platform as another user.

    Security requirements:
    - Only super_admin and admin roles can impersonate
    - Cannot impersonate other admins
    - Cannot impersonate yourself
    - Session automatically expires after 30 minutes
    - All actions during impersonation are logged

    Returns an impersonation session that must be stored client-side.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    # Only super_admin and admin can impersonate
    if role not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=403,
            detail=t("errors.only_admin_can_impersonate", locale)
        )

    # Cannot impersonate yourself
    if target_user_id == admin_user_id:
        raise HTTPException(status_code=400, detail=t("errors.cannot_impersonate_self", locale))

    try:
        supabase = get_supabase_service()

        # Get target user
        try:
            user_response = supabase.auth.admin.get_user_by_id(target_user_id)
            target_user = user_response.user
        except Exception:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        if not target_user:
            raise HTTPException(status_code=404, detail=t("errors.user_not_found", locale))

        # Check if target is an admin (cannot impersonate admins)
        target_is_admin, target_role = await check_is_platform_admin(target_user_id)
        if target_is_admin:
            raise HTTPException(
                status_code=403,
                detail=t("errors.cannot_impersonate_admin", locale)
            )

        # Check if user is suspended
        target_metadata = getattr(target_user, "user_metadata", {}) or {}
        if target_metadata.get("is_suspended"):
            raise HTTPException(
                status_code=400,
                detail=t("errors.cannot_impersonate_suspended", locale)
            )

        # Generate session ID and timestamps
        session_id = f"{IMPERSONATION_TOKEN_PREFIX}{uuid.uuid4().hex}"
        started_at = datetime.utcnow()
        expires_at = started_at + timedelta(minutes=IMPERSONATION_MAX_DURATION_MINUTES)

        # Store impersonation session in database
        session_data = {
            "id": session_id,
            "admin_id": admin_user_id,
            "admin_email": admin_email,
            "target_user_id": target_user_id,
            "target_user_email": target_user.email,
            "started_at": started_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "reason": impersonation_request.reason,
            "is_active": True,
        }

        supabase.table("impersonation_sessions").insert(session_data).execute()

        # Log audit event
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="start_impersonation",
            action_category="security",
            actor_id=admin_user_id,
            actor_email=admin_email,
            actor_type="admin",
            resource_type="user",
            resource_id=target_user_id,
            resource_name=target_user.email,
            ip_address=client_ip,
            metadata={
                "session_id": session_id,
                "reason": impersonation_request.reason,
                "expires_at": expires_at.isoformat(),
            },
            is_sensitive=True,
        )

        log_app_event(
            "ADMIN: Started impersonation",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            target_email=target_user.email,
            session_id=session_id,
        )

        session = ImpersonationSession(
            session_id=session_id,
            admin_id=admin_user_id,
            admin_email=admin_email,
            target_user_id=target_user_id,
            target_user_email=target_user.email,
            started_at=started_at.isoformat(),
            expires_at=expires_at.isoformat(),
            reason=impersonation_request.reason,
        )

        return StartImpersonationResponse(success=True, session=session)

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to start impersonation",
            level="ERROR",
            user_id=admin_user_id,
            target_user_id=target_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to start impersonation")


@router.post("/impersonation/end")
@limiter.limit("30/minute")
async def end_impersonation(
    request: Request,
    user: dict = Depends(get_current_user),
    session_id: Optional[str] = Query(None, description="Specific session ID to end"),
):
    """
    End an active impersonation session.

    If session_id is provided, ends that specific session.
    Otherwise, ends all active sessions for the current admin.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Build query to find active sessions
        query = supabase.table("impersonation_sessions").select("*").eq(
            "admin_id", admin_user_id
        ).eq("is_active", True)

        if session_id:
            query = query.eq("id", session_id)

        result = query.execute()
        sessions = result.data or []

        if not sessions:
            return {
                "success": True,
                "message": "No active impersonation sessions found",
                "ended_count": 0,
            }

        # End each session
        ended_count = 0
        for session in sessions:
            supabase.table("impersonation_sessions").update({
                "is_active": False,
                "ended_at": datetime.utcnow().isoformat(),
                "ended_reason": "manual",
            }).eq("id", session["id"]).execute()

            # Log audit event for each ended session
            client_ip = request.client.host if request.client else None
            await log_platform_audit(
                action="end_impersonation",
                action_category="security",
                actor_id=admin_user_id,
                actor_email=admin_email,
                actor_type="admin",
                resource_type="user",
                resource_id=session["target_user_id"],
                resource_name=session.get("target_user_email"),
                ip_address=client_ip,
                metadata={
                    "session_id": session["id"],
                    "duration_minutes": _calculate_duration_minutes(session["started_at"]),
                },
                is_sensitive=True,
            )

            ended_count += 1

        log_app_event(
            "ADMIN: Ended impersonation",
            user_id=admin_user_id,
            ended_count=ended_count,
        )

        return {
            "success": True,
            "message": f"Ended {ended_count} impersonation session(s)",
            "ended_count": ended_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to end impersonation",
            level="ERROR",
            user_id=admin_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to end impersonation")


@router.get("/impersonation/status")
@limiter.limit("60/minute")
async def get_impersonation_status(
    request: Request,
    user: dict = Depends(get_current_user),
    session_id: Optional[str] = Query(None, description="Specific session ID to check"),
):
    """
    Check the current impersonation status.

    If session_id is provided, validates that specific session.
    Otherwise, returns any active session for the current admin.
    """
    admin_user_id = user.get("id")

    # Verify admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin:
        return ImpersonationStatusResponse(is_impersonating=False)

    try:
        supabase = get_supabase_service()

        # Build query
        query = supabase.table("impersonation_sessions").select("*").eq(
            "admin_id", admin_user_id
        ).eq("is_active", True)

        if session_id:
            query = query.eq("id", session_id)

        result = query.order("started_at", desc=True).limit(1).maybe_single().execute()

        if not result or not result.data:
            return ImpersonationStatusResponse(is_impersonating=False)

        session_data = result.data

        # Check if session has expired
        expires_at = datetime.fromisoformat(session_data["expires_at"].replace("Z", "+00:00"))
        now = datetime.utcnow().replace(tzinfo=expires_at.tzinfo)

        if now > expires_at:
            # Session expired - mark as inactive
            supabase.table("impersonation_sessions").update({
                "is_active": False,
                "ended_at": datetime.utcnow().isoformat(),
                "ended_reason": "expired",
            }).eq("id", session_data["id"]).execute()

            # Log expiration
            await log_platform_audit(
                action="impersonation_expired",
                action_category="security",
                actor_id=admin_user_id,
                actor_type="system",
                resource_type="user",
                resource_id=session_data["target_user_id"],
                resource_name=session_data.get("target_user_email"),
                metadata={"session_id": session_data["id"]},
            )

            return ImpersonationStatusResponse(is_impersonating=False)

        # Return active session
        session = ImpersonationSession(
            session_id=session_data["id"],
            admin_id=session_data["admin_id"],
            admin_email=session_data["admin_email"],
            target_user_id=session_data["target_user_id"],
            target_user_email=session_data["target_user_email"],
            started_at=session_data["started_at"],
            expires_at=session_data["expires_at"],
            reason=session_data["reason"],
        )

        return ImpersonationStatusResponse(is_impersonating=True, session=session)

    except Exception as e:
        log_app_event(
            "ADMIN: Failed to check impersonation status",
            level="ERROR",
            user_id=admin_user_id,
            error=str(e)
        )
        return ImpersonationStatusResponse(is_impersonating=False)


@router.get("/impersonation/sessions")
@limiter.limit("30/minute")
async def list_impersonation_sessions(
    request: Request,
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_inactive: bool = Query(False, description="Include ended sessions"),
):
    """
    List impersonation sessions (super_admin only).

    Returns history of impersonation sessions for audit purposes.
    """
    admin_user_id = user.get("id")
    admin_email = user.get("email")
    locale = get_locale_from_request(request)

    # Verify super_admin access
    is_admin, role = await check_is_platform_admin(admin_user_id)
    if not is_admin or role != "super_admin":
        raise HTTPException(status_code=403, detail=t("errors.super_admin_access_required", locale))

    try:
        supabase = get_supabase_service()

        # Build query
        query = supabase.table("impersonation_sessions").select("*", count="exact")

        if not include_inactive:
            query = query.eq("is_active", True)

        # Paginate
        offset = (page - 1) * page_size
        query = query.order("started_at", desc=True).range(offset, offset + page_size - 1)

        result = query.execute()
        sessions_data = result.data or []
        total = result.count or 0

        sessions = [
            {
                "session_id": s["id"],
                "admin_id": s["admin_id"],
                "admin_email": s["admin_email"],
                "target_user_id": s["target_user_id"],
                "target_user_email": s["target_user_email"],
                "started_at": s["started_at"],
                "expires_at": s["expires_at"],
                "ended_at": s.get("ended_at"),
                "ended_reason": s.get("ended_reason"),
                "reason": s["reason"],
                "is_active": s["is_active"],
            }
            for s in sessions_data
        ]

        # Log this access (audit the auditor)
        client_ip = request.client.host if request.client else None
        await log_platform_audit(
            action="view_impersonation_sessions",
            action_category="admin",
            actor_id=admin_user_id,
            actor_email=admin_email,
            actor_type="admin",
            ip_address=client_ip,
            metadata={"page": page, "include_inactive": include_inactive},
        )

        return {
            "sessions": sessions,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to list impersonation sessions",
            level="ERROR",
            user_id=admin_user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to list impersonation sessions")


def _calculate_duration_minutes(started_at_str: str) -> float:
    """Calculate duration in minutes from start time to now."""
    try:
        started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
        now = datetime.utcnow().replace(tzinfo=started_at.tzinfo)
        duration = now - started_at
        return round(duration.total_seconds() / 60, 1)
    except Exception:
        return 0.0


# =============================================================================
# MODEL ANALYTICS
# =============================================================================

@router.get("/model-analytics")
@limiter.limit("60/minute;300/hour")
async def get_model_analytics(request: Request, user: dict = Depends(get_current_user)):
    """
    Get model performance analytics for admin dashboard.

    Returns overall and per-department model rankings including:
    - Average rank (lower is better)
    - Win counts and win rates
    - Session counts
    - Department-specific breakdowns
    """
    user_id = user.get("id")

    # Verify admin access
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Get leaderboard summary which includes both overall and department data
        summary = leaderboard_module.get_leaderboard_summary()

        # Transform overall leaderboard
        overall_data = summary.get("overall", {})
        overall_leaderboard = [
            ModelRanking(
                model=m["model"],
                avg_rank=m["avg_rank"],
                sessions=m["sessions"],
                wins=m["wins"],
                win_rate=m["win_rate"]
            )
            for m in overall_data.get("leaderboard", [])
        ]

        overall_leader = None
        leader_data = overall_data.get("leader")
        if leader_data:
            overall_leader = ModelRanking(
                model=leader_data["model"],
                avg_rank=leader_data["avg_rank"],
                sessions=leader_data["sessions"],
                wins=leader_data["wins"],
                win_rate=leader_data["win_rate"]
            )

        # Transform department leaderboards
        departments_list = []
        for dept_name, dept_data in summary.get("departments", {}).items():
            dept_leaderboard = [
                ModelRanking(
                    model=m["model"],
                    avg_rank=m["avg_rank"],
                    sessions=m["sessions"],
                    wins=m["wins"],
                    win_rate=m["win_rate"]
                )
                for m in dept_data.get("leaderboard", [])
            ]

            dept_leader = None
            dept_leader_data = dept_data.get("leader")
            if dept_leader_data:
                dept_leader = ModelRanking(
                    model=dept_leader_data["model"],
                    avg_rank=dept_leader_data["avg_rank"],
                    sessions=dept_leader_data["sessions"],
                    wins=dept_leader_data["wins"],
                    win_rate=dept_leader_data["win_rate"]
                )

            departments_list.append(DepartmentLeaderboard(
                department=dept_name,
                leader=dept_leader,
                sessions=dept_data.get("sessions", 0),
                leaderboard=dept_leaderboard
            ))

        # Sort departments by session count (most active first)
        departments_list.sort(key=lambda d: d.sessions, reverse=True)

        log_app_event(
            "ADMIN: Fetched model analytics",
            user_id=user_id
        )

        return ModelAnalyticsResponse(
            overall_leader=overall_leader,
            total_sessions=overall_data.get("total_sessions", 0),
            overall_leaderboard=overall_leaderboard,
            departments=departments_list
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "ADMIN: Failed to get model analytics",
            level="ERROR",
            user_id=user_id,
            error=str(e)
        )
        raise SecureHTTPException.internal_error("Failed to get model analytics")
