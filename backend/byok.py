"""
BYOK (Bring Your Own Key) Service

Retrieves and manages user API keys for OpenRouter queries.
Keys are stored encrypted in Supabase and decrypted on-demand.
"""

import os
from typing import Optional, Tuple
from .database import get_supabase_service
from .utils.encryption import decrypt_api_key


# System fallback key from environment
SYSTEM_OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")


async def get_user_api_key(user_id: str) -> Optional[str]:
    """
    Get the decrypted OpenRouter API key for a user.

    Args:
        user_id: The user's UUID

    Returns:
        The decrypted API key, or None if not configured
    """
    db = get_supabase_service()
    if not db:
        return None

    try:
        # Use maybe_single() to avoid exception when no row found
        result = db.table("user_api_keys").select(
            "encrypted_key, is_valid, is_active"
        ).eq("user_id", user_id).maybe_single().execute()

        if not result.data:
            return None

        # Only return valid AND active keys
        if not result.data.get("is_valid", True):
            return None
        if not result.data.get("is_active", True):
            return None

        # SECURITY: Use per-user derived key for decryption
        return decrypt_api_key(result.data["encrypted_key"], user_id=user_id)

    except Exception as e:
        print(f"[BYOK] Error fetching key for user {user_id}: {e}")
        return None


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
            result.data and
            result.data.get("is_valid", True) and
            result.data.get("is_active", True)
        )

    except Exception:
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
