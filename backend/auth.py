"""Authentication utilities for verifying Supabase JWT tokens."""

import logging
import time
from collections import defaultdict
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from .database import get_supabase
from .security import log_security_event, get_client_ip

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
                detail="Too many failed attempts. Please try again later.",
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
            detail="Authentication required",
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
                detail="Authentication required",
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
            detail="Authentication required",
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
