"""Authentication utilities for verifying Supabase JWT tokens."""

import logging
import time
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from .database import get_supabase, get_supabase_service
from .security import log_security_event, get_client_ip
from .i18n import t, get_locale_from_request

logger = logging.getLogger(__name__)

# =============================================================================
# AUTH FAILURE TRACKING (Brute Force Protection)
# =============================================================================
# Track failed auth attempts per IP to prevent brute force attacks

_failed_attempts: dict[str, list[float]] = defaultdict(list)
_lockout_until: dict[str, float] = {}  # IP -> lockout expiry timestamp
_LOCKOUT_THRESHOLD = 10  # Failures before lockout
_LOCKOUT_WINDOW = 300  # 5 minute window for counting failures
_LOCKOUT_DURATION = 900  # 15 minute lockout once triggered


def _cleanup_old_attempts(ip: str) -> None:
    """Remove attempts older than the lockout window."""
    cutoff = time.time() - _LOCKOUT_WINDOW
    _failed_attempts[ip] = [t for t in _failed_attempts[ip] if t > cutoff]


def is_ip_locked_out(ip: str) -> bool:
    """Check if an IP is locked out due to too many failures."""
    now = time.time()

    # Check if there's an active lockout
    if ip in _lockout_until:
        if now < _lockout_until[ip]:
            return True
        else:
            # Lockout expired, clean up
            del _lockout_until[ip]

    return False


def record_auth_failure(ip: str) -> int:
    """Record a failed auth attempt. Returns failure count."""
    _cleanup_old_attempts(ip)
    _failed_attempts[ip].append(time.time())
    count = len(_failed_attempts[ip])

    # Trigger lockout if threshold reached
    if count >= _LOCKOUT_THRESHOLD and ip not in _lockout_until:
        _lockout_until[ip] = time.time() + _LOCKOUT_DURATION
        log_security_event(
            "AUTH_LOCKOUT",
            ip_address=ip,
            details={"failures": count, "lockout_minutes": _LOCKOUT_DURATION // 60},
            severity="WARNING"
        )
    return count


def clear_auth_failures(ip: str) -> None:
    """Clear failed attempts for an IP after successful auth."""
    if ip in _failed_attempts:
        del _failed_attempts[ip]
    # Note: We don't clear lockout here - lockouts must expire naturally
    # This prevents attackers from clearing lockout by guessing correctly once

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Verify JWT token and return user data.

    Args:
        request: FastAPI request object (for IP-based lockout)
        credentials: Bearer token from Authorization header

    Returns:
        Dict with user 'id', 'email', and 'access_token'

    Raises:
        HTTPException 401 if token is missing or invalid
        HTTPException 429 if IP is locked out due to too many failures
    """
    locale = get_locale_from_request(request)
    client_ip = get_client_ip(request)

    # Check for lockout before processing
    if client_ip in _lockout_until:
        remaining = int(_lockout_until[client_ip] - time.time())
        if remaining > 0:
            log_security_event(
                "AUTH_BLOCKED",
                ip_address=client_ip,
                details={"reason": "ip_locked_out", "remaining_seconds": remaining},
                severity="WARNING"
            )
            raise HTTPException(
                status_code=429,
                detail=t('errors.rate_limit_exceeded', locale),
                headers={"Retry-After": str(remaining)}
            )
        else:
            # Lockout expired, clean up
            del _lockout_until[client_ip]

    if not credentials:
        record_auth_failure(client_ip)
        log_security_event("AUTH_FAILURE", ip_address=client_ip, details={"reason": "missing_token"}, severity="WARNING")
        raise HTTPException(
            status_code=401,
            detail=t('errors.unauthorized', locale),
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials

    try:
        supabase = get_supabase()
        # Verify the JWT token with Supabase
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            record_auth_failure(client_ip)
            log_security_event("AUTH_FAILURE", ip_address=client_ip, details={"reason": "invalid_token"}, severity="WARNING")
            raise HTTPException(
                status_code=401,
                detail=t('errors.unauthorized', locale),
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Success - clear any failed attempts for this IP
        clear_auth_failures(client_ip)

        return {
            "id": str(user_response.user.id),
            "email": user_response.user.email,
            "access_token": token  # Include token for RLS-authenticated queries
        }

    except HTTPException:
        raise
    except Exception as e:
        record_auth_failure(client_ip)
        logger.warning(f"Token verification failed: {type(e).__name__}: {e}")
        log_security_event("AUTH_FAILURE", ip_address=client_ip, details={"reason": "verification_error", "error": str(e)}, severity="WARNING")
        raise HTTPException(
            status_code=401,
            detail=t('errors.unauthorized', locale),
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    Optionally verify JWT token. Returns None if no token provided.
    Useful for endpoints that work differently for authenticated vs anonymous users.

    Args:
        request: FastAPI request object (for IP-based lockout)
        credentials: Bearer token from Authorization header (optional)

    Returns:
        Dict with user 'id', 'email', and 'access_token', or None if no token
    """
    if not credentials:
        return None

    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None


# =============================================================================
# IMPERSONATION CONTEXT
# =============================================================================
# When an admin is impersonating a user, we need to switch the effective user
# context for data queries. The admin passes their impersonation session ID
# in the X-Impersonate-User header, and we validate it and return an augmented
# user dict with the impersonated user's ID/email.


async def get_effective_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_impersonate_user: Optional[str] = Header(None, alias="X-Impersonate-User")
) -> dict:
    """
    Get the effective user context, respecting impersonation headers.

    If X-Impersonate-User header is provided with a valid session ID,
    returns the impersonated user's context instead of the admin's.

    This enables admins to see exactly what a user sees during support.

    Args:
        request: FastAPI request object
        credentials: Bearer token from Authorization header
        x_impersonate_user: Optional impersonation session ID (e.g., "imp_abc123...")

    Returns:
        Dict with effective user 'id', 'email', 'access_token', and impersonation metadata:
        - _is_impersonating: True if currently impersonating
        - _admin_id: Original admin's user ID (if impersonating)
        - _admin_email: Original admin's email (if impersonating)
        - _session_id: Impersonation session ID (if impersonating)

    Raises:
        HTTPException 401 if token is missing or invalid
        HTTPException 403 if impersonation session is invalid or expired
    """
    # First, authenticate the actual user (admin)
    user = await get_current_user(request, credentials)

    # If no impersonation header, return normal user context
    if not x_impersonate_user:
        return user

    # Validate the impersonation session
    supabase = get_supabase_service()

    # Session ID must start with "imp_" prefix
    if not x_impersonate_user.startswith("imp_"):
        logger.warning(f"Invalid impersonation session format: {x_impersonate_user[:20]}...")
        raise HTTPException(
            status_code=403,
            detail="Invalid impersonation session format"
        )

    # Look up the session
    session_result = supabase.table("impersonation_sessions").select("*").eq(
        "id", x_impersonate_user
    ).eq(
        "admin_id", user["id"]  # Ensure the requesting admin owns this session
    ).eq(
        "is_active", True
    ).maybe_single().execute()

    if not session_result.data:
        logger.warning(f"Invalid or inactive impersonation session: {x_impersonate_user}")
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired impersonation session"
        )

    session = session_result.data

    # Check if session has expired
    expires_at_str = session["expires_at"]
    # Handle both ISO formats with and without 'Z' suffix
    if expires_at_str.endswith("Z"):
        expires_at_str = expires_at_str[:-1] + "+00:00"
    elif "+" not in expires_at_str and "-" not in expires_at_str[-6:]:
        # Assume UTC if no timezone
        expires_at_str = expires_at_str + "+00:00"

    expires_at = datetime.fromisoformat(expires_at_str)
    now = datetime.now(timezone.utc)

    if now > expires_at:
        # Auto-deactivate expired session
        logger.info(f"Impersonation session expired: {x_impersonate_user}")
        supabase.table("impersonation_sessions").update({
            "is_active": False,
            "ended_at": now.isoformat(),
            "ended_reason": "expired"
        }).eq("id", x_impersonate_user).execute()

        raise HTTPException(
            status_code=403,
            detail="Impersonation session expired"
        )

    # Log the impersonation API call for audit trail
    log_security_event(
        "IMPERSONATION_API_CALL",
        ip_address=get_client_ip(request),
        user_id=user["id"],
        details={
            "session_id": x_impersonate_user,
            "target_user_id": session["target_user_id"],
            "endpoint": str(request.url.path),
            "method": request.method,
        },
        severity="INFO"
    )

    # Return augmented user context with impersonated user's identity
    return {
        "id": session["target_user_id"],  # Override with impersonated user
        "email": session["target_user_email"],
        "access_token": user["access_token"],  # Keep admin's token for auth
        "_is_impersonating": True,
        "_admin_id": user["id"],
        "_admin_email": user["email"],
        "_session_id": x_impersonate_user,
    }
