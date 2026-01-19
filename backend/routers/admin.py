"""
Admin Router

Platform administration endpoints for super admins:
- Check admin access
- List all users across all companies
- Manage platform admins
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List

from ..auth import get_current_user
from ..database import get_supabase_service, get_supabase_with_auth
from ..security import SecureHTTPException, log_app_event

# Import shared rate limiter
from ..rate_limit import limiter


router = APIRouter(prefix="/admin", tags=["admin"])


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
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[dict] = None


class PlatformStats(BaseModel):
    """Platform-wide statistics."""
    total_users: int
    total_companies: int
    total_conversations: int
    total_messages: int
    active_users_24h: int
    active_users_7d: int


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

        if result.data:
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
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase_service()

        # Calculate offset
        offset = (page - 1) * page_size

        # Query auth.users via admin API
        # Note: This requires service role key
        query = supabase.auth.admin.list_users()

        # Get all users (Supabase auth admin API)
        all_users = query

        # Helper to convert datetime to string
        def to_str(value):
            if value is None:
                return None
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            return str(value)

        # Filter by search if provided
        users_list = []
        for u in all_users:
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
            search=search
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


@router.get("/admins")
@limiter.limit("30/minute;100/hour")
async def list_admins(request: Request, user: dict = Depends(get_current_user)):
    """
    List all platform admins (admin only).
    """
    user_id = user.get("id")

    # Verify admin access
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

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
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

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
                except Exception:
                    pass

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
    is_admin, role = await check_is_platform_admin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase_service()

        # Get total users from auth
        all_users = supabase.auth.admin.list_users()
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
