"""
BYOK (Bring Your Own Key) Service

Retrieves and manages user API keys for OpenRouter queries.
Keys are stored encrypted in Supabase and decrypted on-demand.

Security features:
- Per-user encryption keys via HKDF
- 90-day key expiration
- Audit logging for key usage
- Soft-delete on rotation (revoked_at)
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from .database import get_supabase_service
from .utils.encryption import decrypt_api_key, DecryptionError
from .security import log_app_event, log_error

logger = logging.getLogger(__name__)


# System fallback key from environment
SYSTEM_OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")

# Key expiration period in days
KEY_EXPIRY_DAYS = 90


def _is_key_expired(key_data: Dict[str, Any]) -> bool:
    """Check if a key is expired or revoked."""
    # Check if revoked
    if key_data.get("revoked_at"):
        return True

    # Check expiry date
    expires_at = key_data.get("expires_at")
    if expires_at:
        # Parse ISO format if string
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            except ValueError:
                return False
        # Compare with current time
        if expires_at < datetime.now(timezone.utc):
            return True

    return False


def _log_key_usage(user_id: str, db) -> None:
    """Update last_used_at timestamp for audit purposes."""
    try:
        db.table("user_api_keys").update({
            "last_used_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).execute()
    except Exception as e:
        logger.debug("Failed to update key last_used_at for user %s: %s", user_id, e)


async def get_user_api_key(user_id: str, log_usage: bool = True) -> Optional[str]:
    """
    Get the decrypted OpenRouter API key for a user.

    Args:
        user_id: The user's UUID
        log_usage: Whether to update last_used_at (default True)

    Returns:
        The decrypted API key, or None if not configured, expired, or invalid
    """
    db = get_supabase_service()
    if not db:
        return None

    try:
        # Fetch key with expiry info
        result = db.table("user_api_keys").select(
            "encrypted_key, is_valid, is_active, expires_at, revoked_at"
        ).eq("user_id", user_id).maybe_single().execute()

        if not result or not result.data:
            return None

        # Check if key is valid and active
        if not result.data.get("is_valid", True):
            log_app_event("byok_key_invalid", user_id=user_id, level="WARNING")
            return None
        if not result.data.get("is_active", True):
            return None

        # Check if key is expired or revoked
        if _is_key_expired(result.data):
            log_app_event("byok_key_expired", user_id=user_id, level="WARNING")
            return None

        # Update last_used_at for audit
        if log_usage:
            _log_key_usage(user_id, db)

        # SECURITY: Use per-user derived key for decryption
        return decrypt_api_key(result.data["encrypted_key"], user_id=user_id)

    except DecryptionError as e:
        # Key is corrupted or was encrypted with a different master key
        # Mark the key as invalid so the user knows to re-enter it
        log_app_event(
            "get_user_api_key_failed",
            user_id=user_id,
            level="ERROR",
            details={"error": str(e), "action": "key_invalidated"}
        )
        try:
            db.table("user_api_keys").update({
                "is_valid": False
            }).eq("user_id", user_id).execute()
        except Exception as e2:
            logger.warning("Failed to mark key as invalid for user %s: %s", user_id, e2)
        return None
    except Exception as e:
        log_error("get_user_api_key", e, user_id=user_id)
        return None


async def get_key_expiry_info(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get expiry information for a user's API key.

    Returns:
        Dict with expires_at, days_remaining, is_expired, or None if no key
    """
    db = get_supabase_service()
    if not db:
        return None

    try:
        result = db.table("user_api_keys").select(
            "expires_at, revoked_at, last_used_at, rotation_count, created_at"
        ).eq("user_id", user_id).maybe_single().execute()

        if not result or not result.data:
            return None

        expires_at = result.data.get("expires_at")
        is_expired = _is_key_expired(result.data)

        days_remaining = None
        if expires_at and not is_expired:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            delta = expires_at - datetime.now(timezone.utc)
            days_remaining = max(0, delta.days)

        return {
            "expires_at": result.data.get("expires_at"),
            "days_remaining": days_remaining,
            "is_expired": is_expired,
            "is_revoked": result.data.get("revoked_at") is not None,
            "last_used_at": result.data.get("last_used_at"),
            "rotation_count": result.data.get("rotation_count", 0),
            "created_at": result.data.get("created_at")
        }

    except Exception as e:
        log_error("get_key_expiry_info", e, user_id=user_id)
        return None


def log_api_key_event(
    user_id: str,
    event_type: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log an API key lifecycle event to the audit log.

    Args:
        user_id: The user's UUID
        event_type: One of: created, rotated, revoked, expired, used, validation_failed
        ip_address: Client IP address (optional)
        user_agent: Client user agent (optional)
        metadata: Additional event data (optional)
    """
    db = get_supabase_service()
    if not db:
        return

    try:
        db.table("api_key_audit_log").insert({
            "user_id": user_id,
            "event_type": event_type,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "metadata": metadata or {}
        }).execute()
    except Exception as e:
        # Log failure but don't raise - audit logging is non-critical
        log_error("log_api_key_event", e, user_id=user_id)


async def get_api_key_for_request(user_id: Optional[str] = None) -> Tuple[str, bool]:
    """
    Get the appropriate API key for a request.

    Priority:
    1. User's BYOK key (if user_id provided and key exists)
    2. System key (fallback)

    Args:
        user_id: Optional user UUID

    Returns:
        Tuple of (api_key, is_byok) where is_byok indicates if it's the user's own key
    """
    # Try user's BYOK key first
    if user_id:
        user_key = await get_user_api_key(user_id)
        if user_key:
            return (user_key, True)

    # Fall back to system key
    if not SYSTEM_OPENROUTER_KEY:
        raise ValueError(
            "No API key available. User has no BYOK key configured and "
            "OPENROUTER_API_KEY environment variable is not set."
        )

    return (SYSTEM_OPENROUTER_KEY, False)


def has_byok_configured(user_id: str) -> bool:
    """
    Check if a user has a BYOK key configured (sync version for quick checks).

    Note: This is a synchronous function for use in validation.
    For actual key retrieval, use get_user_api_key.
    """
    db = get_supabase_service()
    if not db:
        return False

    try:
        # Use maybe_single() to avoid exception when no row found
        result = db.table("user_api_keys").select(
            "id, is_valid, is_active"
        ).eq("user_id", user_id).maybe_single().execute()

        # Key must exist, be valid, and be active
        return bool(
            result and result.data and
            result.data.get("is_valid", True) and
            result.data.get("is_active", True)
        )

    except Exception as e:
        logger.debug("Failed to check BYOK config for user %s: %s", user_id, e)
        return False


# Council mode configuration
COUNCIL_MODELS = [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "google/gemini-1.5-pro",
    "x-ai/grok-2",
    "deepseek/deepseek-chat"
]

QUICK_MODEL = "anthropic/claude-3.5-sonnet"


def get_models_for_mode(mode: str) -> list:
    """
    Get the models to use based on the council mode.

    Args:
        mode: "quick" for single model, "full_council" for all 5 models

    Returns:
        List of model identifiers
    """
    if mode == "quick":
        return [QUICK_MODEL]
    return COUNCIL_MODELS
