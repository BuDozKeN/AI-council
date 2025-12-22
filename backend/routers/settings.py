"""
User Settings API Router

Endpoints for managing user preferences and BYOK (Bring Your Own Key):
- OpenRouter API key management (encrypted storage)
- Council mode preferences (quick vs full_council)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from ..auth import get_current_user
from ..database import get_supabase_with_auth
from ..security import log_app_event
from ..utils.encryption import encrypt_api_key, decrypt_api_key, get_key_suffix, mask_api_key


router = APIRouter(prefix="/api/settings", tags=["settings"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class OpenRouterKeyRequest(BaseModel):
    """Request to save an OpenRouter API key."""
    key: str


class OpenRouterKeyResponse(BaseModel):
    """Response after saving/retrieving API key status."""
    status: str  # "connected" | "not_connected" | "invalid" | "disabled"
    masked_key: Optional[str] = None  # e.g., "sk-or-v1-••••••••1234"
    is_valid: bool = False
    is_active: bool = True  # User toggle to temporarily disable


class UserSettingsResponse(BaseModel):
    """User settings response."""
    default_mode: str = "full_council"
    has_api_key: bool = False
    api_key_status: Optional[OpenRouterKeyResponse] = None


class UpdateSettingsRequest(BaseModel):
    """Request to update user settings."""
    default_mode: Optional[str] = None  # "quick" | "full_council"


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def validate_openrouter_key(key: str) -> bool:
    """
    Test if an OpenRouter API key is valid.
    Makes a minimal API call to verify the key works.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {key}"}
            )
            return response.status_code == 200
    except Exception as e:
        print(f"[BYOK] Key validation error: {e}")
        return False


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/openrouter-key")
async def get_openrouter_key_status(
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Get the status of the user's OpenRouter API key.
    Returns masked key if connected, or not_connected status.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    try:
        # Use maybe_single() to avoid exception when no row found
        result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_valid, is_active"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception as e:
        print(f"[BYOK] Error fetching key status: {e}")
        return OpenRouterKeyResponse(
            status="not_connected",
            is_valid=False,
            is_active=True
        )

    if not result.data:
        return OpenRouterKeyResponse(
            status="not_connected",
            is_valid=False,
            is_active=True
        )

    # Decrypt to get the full key for masking (we stored suffix too)
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"])
        masked = mask_api_key(raw_key)
    except Exception:
        masked = f"sk-or-v1-••••••••{result.data.get('key_suffix', '****')}"

    is_active = result.data.get("is_active", True)
    is_valid = result.data["is_valid"]

    # Determine status based on is_active and is_valid
    if not is_active:
        status = "disabled"
    elif is_valid:
        status = "connected"
    else:
        status = "invalid"

    return OpenRouterKeyResponse(
        status=status,
        masked_key=masked,
        is_valid=is_valid,
        is_active=is_active
    )


@router.post("/openrouter-key")
async def save_openrouter_key(
    request: OpenRouterKeyRequest,
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Save or update the user's OpenRouter API key.
    Validates the key before saving.
    """
    key = request.key.strip()

    # Basic format validation
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    if not key.startswith("sk-or-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid key format. OpenRouter keys start with 'sk-or-'"
        )

    # Validate with OpenRouter
    is_valid = await validate_openrouter_key(key)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenRouter API key. Please check it's copied correctly and has credits."
        )

    # Encrypt and save
    encrypted = encrypt_api_key(key)
    suffix = get_key_suffix(key)

    db = get_supabase_with_auth(current_user["access_token"])

    # Upsert (insert or update)
    db.table("user_api_keys").upsert({
        "user_id": current_user["id"],
        "encrypted_key": encrypted,
        "key_suffix": suffix,
        "is_valid": True,
        "last_validated_at": "now()"
    }, on_conflict="user_id").execute()

    log_app_event(
        "BYOK_KEY_SAVED",
        user_id=current_user["id"],
        details={"key_suffix": suffix}
    )

    return OpenRouterKeyResponse(
        status="connected",
        masked_key=mask_api_key(key),
        is_valid=True
    )


@router.delete("/openrouter-key")
async def delete_openrouter_key(
    current_user=Depends(get_current_user)
):
    """
    Remove the user's OpenRouter API key.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    db.table("user_api_keys").delete().eq(
        "user_id", current_user["id"]
    ).execute()

    log_app_event(
        "BYOK_KEY_DELETED",
        user_id=current_user["id"]
    )

    return {"status": "deleted"}


@router.post("/openrouter-key/test")
async def test_openrouter_key(
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Test the user's stored OpenRouter API key.
    Updates the is_valid status.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    try:
        result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_active"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception as e:
        print(f"[BYOK] Error fetching key for test: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    if not result.data:
        raise HTTPException(status_code=404, detail="No API key configured")

    # Decrypt and test
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"])
    except Exception as e:
        # Key corruption - delete it
        db.table("user_api_keys").delete().eq(
            "user_id", current_user["id"]
        ).execute()
        raise HTTPException(status_code=400, detail="Stored key is corrupted. Please add a new key.")

    is_valid = await validate_openrouter_key(raw_key)
    is_active = result.data.get("is_active", True)

    # Update validation status
    db.table("user_api_keys").update({
        "is_valid": is_valid,
        "last_validated_at": "now()"
    }).eq("user_id", current_user["id"]).execute()

    masked = mask_api_key(raw_key)

    # Determine status
    if not is_active:
        status = "disabled"
    elif is_valid:
        status = "connected"
    else:
        status = "invalid"

    return OpenRouterKeyResponse(
        status=status,
        masked_key=masked,
        is_valid=is_valid,
        is_active=is_active
    )


@router.post("/openrouter-key/toggle")
async def toggle_openrouter_key(
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Toggle the is_active status of the user's OpenRouter API key.
    Allows users to temporarily disable their key without deleting it.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    try:
        result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_valid, is_active"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception as e:
        print(f"[BYOK] Error fetching key for toggle: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    if not result.data:
        raise HTTPException(status_code=404, detail="No API key configured")

    # Toggle is_active
    new_is_active = not result.data.get("is_active", True)

    db.table("user_api_keys").update({
        "is_active": new_is_active
    }).eq("user_id", current_user["id"]).execute()

    log_app_event(
        "BYOK_KEY_TOGGLED",
        user_id=current_user["id"],
        details={"is_active": new_is_active}
    )

    # Get masked key for response
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"])
        masked = mask_api_key(raw_key)
    except Exception:
        masked = f"sk-or-v1-••••••••{result.data.get('key_suffix', '****')}"

    is_valid = result.data["is_valid"]

    # Determine status
    if not new_is_active:
        status = "disabled"
    elif is_valid:
        status = "connected"
    else:
        status = "invalid"

    return OpenRouterKeyResponse(
        status=status,
        masked_key=masked,
        is_valid=is_valid,
        is_active=new_is_active
    )


@router.get("")
async def get_user_settings(
    current_user=Depends(get_current_user)
) -> UserSettingsResponse:
    """
    Get all user settings including BYOK status.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    # Get settings
    try:
        settings_result = db.table("user_settings").select(
            "default_mode"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception as e:
        print(f"[BYOK] Error fetching settings: {e}")
        settings_result = type('obj', (object,), {'data': None})()

    default_mode = "full_council"
    if settings_result.data:
        default_mode = settings_result.data.get("default_mode", "full_council")

    # Get API key status
    try:
        key_result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_valid, is_active"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception as e:
        print(f"[BYOK] Error fetching API key: {e}")
        key_result = type('obj', (object,), {'data': None})()

    api_key_status = None
    has_api_key = False

    if key_result.data:
        has_api_key = True
        try:
            raw_key = decrypt_api_key(key_result.data["encrypted_key"])
            masked = mask_api_key(raw_key)
        except Exception:
            masked = f"sk-or-v1-••••••••{key_result.data.get('key_suffix', '****')}"

        is_active = key_result.data.get("is_active", True)
        is_valid = key_result.data["is_valid"]

        # Determine status
        if not is_active:
            status = "disabled"
        elif is_valid:
            status = "connected"
        else:
            status = "invalid"

        api_key_status = OpenRouterKeyResponse(
            status=status,
            masked_key=masked,
            is_valid=is_valid,
            is_active=is_active
        )

    return UserSettingsResponse(
        default_mode=default_mode,
        has_api_key=has_api_key,
        api_key_status=api_key_status
    )


@router.patch("")
async def update_user_settings(
    request: UpdateSettingsRequest,
    current_user=Depends(get_current_user)
) -> UserSettingsResponse:
    """
    Update user settings.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    updates = {}
    if request.default_mode:
        if request.default_mode not in ("quick", "full_council"):
            raise HTTPException(
                status_code=400,
                detail="Invalid mode. Must be 'quick' or 'full_council'"
            )
        updates["default_mode"] = request.default_mode

    if updates:
        # Upsert settings
        db.table("user_settings").upsert({
            "user_id": current_user["id"],
            **updates
        }, on_conflict="user_id").execute()

    # Return updated settings
    return await get_user_settings(current_user)
