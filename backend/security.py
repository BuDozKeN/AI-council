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
        sensitive_keys = (
            'password', 'token', 'secret', 'key',
            'api_key', 'apikey', 'access_token', 'refresh_token',
            'authorization', 'credential', 'credentials', 'private_key'
        )
        safe_details = {k: v for k, v in details.items()
                       if k.lower() not in sensitive_keys}
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
    """Extract client IP from request, handling proxies securely.

    Only trusts X-Forwarded-For from known proxy IPs to prevent spoofing.
    Configure TRUSTED_PROXIES env var with comma-separated IPs of your load balancers.
    """
    import os

    # Get direct connection IP first
    direct_ip = request.client.host if request.client else "unknown"

    # Load trusted proxy IPs from environment (e.g., your load balancer IPs)
    # Default includes loopback for local development
    trusted_proxies_str = os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1")
    trusted_proxies = {ip.strip() for ip in trusted_proxies_str.split(",") if ip.strip()}

    # Only trust forwarded headers if request comes from a known proxy
    if direct_ip in trusted_proxies:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (original client)
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

    # Fall back to direct connection IP
    return direct_ip


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


def escape_sql_like_pattern(search: str, max_length: int = 100) -> str:
    """
    Escape special SQL LIKE pattern characters for safe use in ilike queries.

    This prevents:
    1. Wildcard injection (%, _) that could cause expensive full-table scans
    2. Overly long search strings that could impact performance

    Args:
        search: The user-provided search string
        max_length: Maximum allowed length (default 100)

    Returns:
        Escaped and length-limited search string
    """
    if not search:
        return ""

    # Limit length to prevent DoS via long search strings
    search = search[:max_length]

    # Escape SQL LIKE special characters
    # % matches any sequence of characters
    # _ matches any single character
    # \ is the escape character itself
    search = search.replace('\\', '\\\\')  # Escape backslash first
    search = search.replace('%', '\\%')
    search = search.replace('_', '\\_')

    return search


# =============================================================================
# GDPR/HIPAA COMPLIANT LOGGING
# =============================================================================
# Application logger that automatically masks PII

app_logger = logging.getLogger("app")
app_logger.setLevel(logging.INFO)

if not app_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '[APP] %(asctime)s - %(levelname)s - %(name)s - %(message)s'
    ))
    app_logger.addHandler(handler)


def mask_email(email: Optional[str]) -> str:
    """Mask email for GDPR/HIPAA compliant logging. Shows domain only."""
    if not email or '@' not in email:
        return "***@***.***"
    _, domain = email.rsplit('@', 1)
    return f"***@{domain}"


def mask_pii(value: Optional[str], show_chars: int = 4) -> str:
    """Mask any PII value, showing only first few characters."""
    if not value:
        return "****"
    if len(value) <= show_chars:
        return "****"
    return f"{value[:show_chars]}..."


def log_billing_event(
    event: str,
    user_id: Optional[str] = None,
    tier: Optional[str] = None,
    status: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """
    Log billing events in a GDPR/HIPAA compliant way.
    User IDs and emails are masked automatically.
    """
    masked_user = mask_id(user_id) if user_id else "unknown"

    msg_parts = [f"[Billing] {event}"]
    if masked_user != "unknown":
        msg_parts.append(f"user={masked_user}")
    if tier:
        msg_parts.append(f"tier={tier}")
    if status:
        msg_parts.append(f"status={status}")

    app_logger.info(" | ".join(msg_parts))


def log_app_event(
    event: str,
    user_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    level: str = "INFO",
    error: Optional[str] = None,
    **kwargs
):
    """
    Log application events in a GDPR/HIPAA compliant way.
    All IDs are automatically masked.

    Usage:
        log_app_event("context_load_failed", user_id=user_id, error=str(e))
        log_app_event("project_created", user_id=user_id, resource_id=project_id)
    """
    masked_user = mask_id(user_id) if user_id else None
    masked_resource = mask_id(resource_id) if resource_id else None

    msg_parts = [f"[APP] {event}"]
    if masked_user:
        msg_parts.append(f"user={masked_user}")
    if masked_resource:
        msg_parts.append(f"resource={masked_resource}")
    if error:
        # Truncate error message to avoid log flooding
        error_msg = str(error)[:200]
        msg_parts.append(f"error={error_msg}")

    # Add any additional kwargs (non-PII only)
    for key, value in kwargs.items():
        if key.lower() not in ('email', 'password', 'token', 'secret', 'key', 'access_token'):
            msg_parts.append(f"{key}={value}")

    message = " | ".join(msg_parts)

    if level == "WARNING":
        app_logger.warning(message)
    elif level == "ERROR":
        app_logger.error(message)
    elif level == "DEBUG":
        app_logger.debug(message)
    else:
        app_logger.info(message)


def log_error(
    operation: str,
    error: Exception,
    user_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    **kwargs
):
    """
    Log an error with context for debugging.
    Use this instead of silently swallowing exceptions.

    Usage:
        try:
            result = fetch_data()
        except Exception as e:
            log_error("fetch_data", e, user_id=user_id)
            return None  # Graceful fallback
    """
    error_type = type(error).__name__
    error_msg = str(error)[:300]  # Truncate long errors

    log_app_event(
        f"{operation}_failed",
        user_id=user_id,
        resource_id=resource_id,
        level="ERROR",
        error=f"{error_type}: {error_msg}",
        **kwargs
    )


# =============================================================================
# ACCESS VERIFICATION (Multi-tenant security)
# =============================================================================

def verify_user_company_access(user_id: str, company_id: str) -> bool:
    """
    Verify that a user has access to a specific company.

    Access is granted if:
    1. User owns the company (companies.user_id = user_id)
    2. User has department access to the company (user_department_access table)

    Args:
        user_id: The authenticated user's ID
        company_id: The company UUID to check access for

    Returns:
        True if user has access, False otherwise
    """
    from .database import get_supabase_service

    client = get_supabase_service()
    if not client:
        log_security_event("ACCESS_CHECK_FAILED", user_id=user_id,
                          details={"reason": "service_client_unavailable"}, severity="ERROR")
        return False

    try:
        # Check if user owns the company
        owner_result = client.table("companies") \
            .select("id") \
            .eq("id", company_id) \
            .eq("user_id", user_id) \
            .execute()

        if owner_result.data:
            return True

        # Check if user has department access to this company
        access_result = client.table("user_department_access") \
            .select("id") \
            .eq("company_id", company_id) \
            .eq("user_id", user_id) \
            .execute()

        if access_result.data:
            return True

        # No access found
        log_security_event("ACCESS_DENIED", user_id=user_id,
                          resource_type="company", resource_id=company_id,
                          severity="WARNING")
        return False

    except Exception as e:
        log_security_event("ACCESS_CHECK_FAILED", user_id=user_id,
                          details={"error": str(e)}, severity="ERROR")
        return False


def verify_user_entry_access(user_id: str, entry_id: str, table_name: str = "knowledge_entries") -> Optional[str]:
    """
    Verify that a user has access to a specific entry by checking its company ownership.

    Args:
        user_id: The authenticated user's ID
        entry_id: The entry UUID to check
        table_name: The table containing the entry (default: knowledge_entries)

    Returns:
        The company_id if user has access, None otherwise
    """
    from .database import get_supabase_service

    client = get_supabase_service()
    if not client:
        return None

    try:
        # Get the entry's company_id
        entry_result = client.table(table_name) \
            .select("company_id") \
            .eq("id", entry_id) \
            .execute()

        if not entry_result.data:
            return None

        company_id = entry_result.data[0].get("company_id")
        if not company_id:
            return None

        # Verify user has access to this company
        if verify_user_company_access(user_id, company_id):
            return company_id

        return None

    except Exception as e:
        log_security_event("ENTRY_ACCESS_CHECK_FAILED", user_id=user_id,
                          resource_id=entry_id, details={"error": str(e)}, severity="ERROR")
        return None
