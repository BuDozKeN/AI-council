"""
Security utilities for enterprise-grade error handling and audit logging.

This module provides:
1. Sanitized error responses that don't leak internal details
2. Security event logging for audit trails
3. Centralized security configuration
"""

import logging
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request

# =============================================================================
# SECURITY LOGGING
# =============================================================================
# Configure security logger for audit trail
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)

# Create handler if not exists
if not security_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '[SECURITY] %(asctime)s - %(levelname)s - %(message)s'
    ))
    security_logger.addHandler(handler)


def log_security_event(
    event_type: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "INFO"
):
    """
    Log a security event for audit trail.

    Event types:
    - AUTH_FAILURE: Failed authentication attempt
    - ACCESS_DENIED: User tried to access resource they don't own
    - RATE_LIMITED: User hit rate limit
    - INVALID_INPUT: Malformed or suspicious input
    - DATA_ACCESS: Sensitive data accessed (for compliance)
    """
    # Mask sensitive IDs for privacy (show first/last 4 chars)
    masked_user = mask_id(user_id) if user_id else "anonymous"
    masked_resource = mask_id(resource_id) if resource_id else None

    log_data = {
        "event": event_type,
        "user": masked_user,
        "resource_type": resource_type,
        "resource_id": masked_resource,
        "ip": ip_address,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if details:
        # Don't log sensitive details
        safe_details = {k: v for k, v in details.items()
                       if k not in ('password', 'token', 'secret', 'key')}
        log_data["details"] = safe_details

    message = f"{event_type} | user={masked_user} | resource={resource_type}:{masked_resource}"

    if severity == "WARNING":
        security_logger.warning(message)
    elif severity == "ERROR":
        security_logger.error(message)
    else:
        security_logger.info(message)


def mask_id(id_value: str) -> str:
    """Mask an ID for logging, showing only first/last 4 chars."""
    if not id_value or len(id_value) < 12:
        return "****"
    return f"{id_value[:4]}...{id_value[-4:]}"


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check for forwarded headers (common with load balancers)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP (original client)
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct connection
    if request.client:
        return request.client.host
    return "unknown"


# =============================================================================
# SANITIZED ERROR RESPONSES
# =============================================================================
# Generic error messages that don't leak internal details

class SecureHTTPException:
    """Factory for security-conscious HTTP exceptions."""

    @staticmethod
    def not_found(
        resource_type: str = "Resource",
        log_details: Optional[Dict] = None,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None
    ) -> HTTPException:
        """Return a generic 404 without leaking what resource was requested."""
        if log_details or resource_id:
            log_security_event(
                "RESOURCE_NOT_FOUND",
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                details=log_details
            )
        return HTTPException(status_code=404, detail="Resource not found")

    @staticmethod
    def access_denied(
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> HTTPException:
        """Return a generic 403 and log the access attempt."""
        log_security_event(
            "ACCESS_DENIED",
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            severity="WARNING"
        )
        return HTTPException(status_code=403, detail="Access denied")

    @staticmethod
    def unauthorized(
        ip_address: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> HTTPException:
        """Return a generic 401 for auth failures."""
        log_security_event(
            "AUTH_FAILURE",
            ip_address=ip_address,
            details=details,
            severity="WARNING"
        )
        return HTTPException(status_code=401, detail="Authentication required")

    @staticmethod
    def bad_request(
        public_message: str = "Invalid request",
        log_message: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> HTTPException:
        """Return a sanitized 400 error."""
        if log_message:
            log_security_event(
                "INVALID_INPUT",
                user_id=user_id,
                details={"internal_message": log_message}
            )
        return HTTPException(status_code=400, detail=public_message)

    @staticmethod
    def internal_error(
        log_message: str,
        user_id: Optional[str] = None,
        include_reference: bool = True
    ) -> HTTPException:
        """
        Return a generic 500 error with optional reference ID for support.
        The actual error is logged but not exposed to the client.
        """
        # Generate a reference ID for support tickets
        ref_id = hashlib.sha256(
            f"{datetime.utcnow().isoformat()}{log_message}".encode()
        ).hexdigest()[:8].upper()

        log_security_event(
            "INTERNAL_ERROR",
            user_id=user_id,
            details={"message": log_message, "reference": ref_id},
            severity="ERROR"
        )

        if include_reference:
            return HTTPException(
                status_code=500,
                detail=f"An error occurred. Reference: {ref_id}"
            )
        return HTTPException(status_code=500, detail="An error occurred")

    @staticmethod
    def rate_limited(
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        limit_type: str = "request"
    ) -> HTTPException:
        """Return 429 for rate limiting."""
        log_security_event(
            "RATE_LIMITED",
            user_id=user_id,
            ip_address=ip_address,
            details={"limit_type": limit_type},
            severity="WARNING"
        )
        return HTTPException(status_code=429, detail="Too many requests")

    @staticmethod
    def payment_required(remaining: int = 0) -> HTTPException:
        """Return 402 for billing limits."""
        return HTTPException(
            status_code=402,
            detail={
                "error": "Query limit reached",
                "action": "upgrade_required",
                "remaining": remaining
            }
        )


# =============================================================================
# INPUT VALIDATION
# =============================================================================

def validate_uuid_format(value: str) -> bool:
    """Check if a string looks like a valid UUID."""
    import re
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(value))


def validate_safe_string(value: str, max_length: int = 1000) -> bool:
    """Check if a string is safe (no null bytes, reasonable length)."""
    if not value:
        return True
    if len(value) > max_length:
        return False
    if '\x00' in value:  # Null byte injection
        return False
    return True
