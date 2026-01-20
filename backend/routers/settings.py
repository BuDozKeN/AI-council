"""
User Settings API Router

Endpoints for managing user preferences and BYOK (Bring Your Own Key):
- OpenRouter API key management (encrypted storage)
- Key rotation and expiry management
- Council mode preferences (quick vs full_council)
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import httpx

from ..auth import get_current_user
from ..database import get_supabase_with_auth
from ..security import log_app_event
from ..utils.encryption import encrypt_api_key, decrypt_api_key, get_key_suffix, mask_api_key, DecryptionError
from ..byok import KEY_EXPIRY_DAYS, log_api_key_event, get_key_expiry_info

# Import shared rate limiter (ensures limits are tracked globally)
from ..rate_limit import limiter


router = APIRouter(prefix="/settings", tags=["settings"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class OpenRouterKeyRequest(BaseModel):
    """Request to save an OpenRouter API key."""
    key: str


class OpenRouterKeyResponse(BaseModel):
    """Response after saving/retrieving API key status."""
    status: str  # "connected" | "not_connected" | "invalid" | "disabled" | "expired"
    masked_key: Optional[str] = None  # e.g., "sk-or-v1-••••••••1234"
    is_valid: bool = False
    is_active: bool = True  # User toggle to temporarily disable
    expires_at: Optional[str] = None  # ISO format expiry date
    days_remaining: Optional[int] = None  # Days until expiry
    rotation_count: int = 0  # Number of times key was rotated


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

    SECURITY: Uses constant-time comparison and minimum response time
    to prevent timing attacks that could enumerate valid key prefixes.
    """
    import asyncio
    import time

    start_time = time.monotonic()
    MIN_RESPONSE_TIME = 0.5  # Minimum 500ms response time

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {key}"}
            )
            result = response.status_code == 200
    except Exception:
        result = False

    # SECURITY: Ensure minimum response time to prevent timing attacks
    elapsed = time.monotonic() - start_time
    if elapsed < MIN_RESPONSE_TIME:
        await asyncio.sleep(MIN_RESPONSE_TIME - elapsed)

    return result


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/openrouter-key")
@limiter.limit("100/minute;500/hour")
async def get_openrouter_key_status(request: Request, current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Get the status of the user's OpenRouter API key.
    Returns masked key if connected, or not_connected status.
    Includes expiry information.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    try:
        # Use maybe_single() to avoid exception when no row found
        result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_valid, is_active, expires_at, revoked_at, rotation_count"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception:
        return OpenRouterKeyResponse(
            status="not_connected",
            is_valid=False,
            is_active=True
        )

    if not result or not result.data:
        return OpenRouterKeyResponse(
            status="not_connected",
            is_valid=False,
            is_active=True
        )

    # Check if revoked
    if result.data.get("revoked_at"):
        return OpenRouterKeyResponse(
            status="not_connected",
            is_valid=False,
            is_active=False
        )

    # Decrypt to get the full key for masking (we stored suffix too)
    # SECURITY: Use per-user derived key for decryption
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"], user_id=current_user["id"])
        masked = mask_api_key(raw_key)
    except Exception:
        masked = f"sk-or-v1-••••••••{result.data.get('key_suffix', '****')}"

    is_active = result.data.get("is_active", True)
    is_valid = result.data["is_valid"]

    # Calculate days remaining
    expires_at = result.data.get("expires_at")
    days_remaining = None
    is_expired = False
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            delta = exp_dt - datetime.now(timezone.utc)
            days_remaining = max(0, delta.days)
            is_expired = delta.total_seconds() < 0
        except ValueError:
            pass

    # Determine status based on expiry, is_active and is_valid
    if is_expired:
        status = "expired"
    elif not is_active:
        status = "disabled"
    elif is_valid:
        status = "connected"
    else:
        status = "invalid"

    return OpenRouterKeyResponse(
        status=status,
        masked_key=masked,
        is_valid=is_valid and not is_expired,
        is_active=is_active,
        expires_at=expires_at,
        days_remaining=days_remaining,
        rotation_count=result.data.get("rotation_count", 0)
    )


@router.post("/openrouter-key")
@limiter.limit("5/minute")
async def save_openrouter_key(request: Request,
    key_request: OpenRouterKeyRequest,
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Save or update the user's OpenRouter API key.
    Validates the key before saving.
    Sets expiry to 90 days from now.
    """
    key = key_request.key.strip()

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
        log_api_key_event(
            current_user["id"],
            "validation_failed",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"reason": "OpenRouter validation failed"}
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenRouter API key. Please check it's copied correctly and has credits."
        )

    # Encrypt and save
    # SECURITY: Use per-user derived key for encryption
    encrypted = encrypt_api_key(key, user_id=current_user["id"])
    suffix = get_key_suffix(key)

    # Calculate expiry date (90 days from now)
    expires_at = datetime.now(timezone.utc) + timedelta(days=KEY_EXPIRY_DAYS)

    db = get_supabase_with_auth(current_user["access_token"])

    # Upsert (insert or update)
    db.table("user_api_keys").upsert({
        "user_id": current_user["id"],
        "encrypted_key": encrypted,
        "key_suffix": suffix,
        "is_valid": True,
        "is_active": True,
        "expires_at": expires_at.isoformat(),
        "revoked_at": None,  # Clear any previous revocation
        "last_validated_at": "now()"
    }, on_conflict="user_id").execute()

    log_app_event(
        "BYOK_KEY_SAVED",
        user_id=current_user["id"],
        details={"key_suffix": suffix}
    )

    # Audit log
    log_api_key_event(
        current_user["id"],
        "created",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"key_suffix": suffix, "expires_at": expires_at.isoformat()}
    )

    return OpenRouterKeyResponse(
        status="connected",
        masked_key=mask_api_key(key),
        is_valid=True,
        is_active=True,
        expires_at=expires_at.isoformat(),
        days_remaining=KEY_EXPIRY_DAYS,
        rotation_count=0
    )


@router.delete("/openrouter-key")
@limiter.limit("10/minute;30/hour")
async def delete_openrouter_key(request: Request, current_user=Depends(get_current_user)
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
@limiter.limit("10/minute;30/hour")
async def test_openrouter_key(request: Request, current_user=Depends(get_current_user)
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
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    if not result or not result.data:
        raise HTTPException(status_code=404, detail="No API key configured")

    # Decrypt and test
    # SECURITY: Use per-user derived key for decryption
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"], user_id=current_user["id"])
    except DecryptionError:
        # Key corruption or master key changed - mark as invalid and prompt re-entry
        db.table("user_api_keys").update({
            "is_valid": False
        }).eq("user_id", current_user["id"]).execute()
        raise HTTPException(
            status_code=400,
            detail="Stored key cannot be decrypted. Please delete and add a new key."
        )

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
@limiter.limit("10/minute;30/hour")
async def toggle_openrouter_key(request: Request, current_user=Depends(get_current_user)
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
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    if not result or not result.data:
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
    # SECURITY: Use per-user derived key for decryption
    try:
        raw_key = decrypt_api_key(result.data["encrypted_key"], user_id=current_user["id"])
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


@router.post("/openrouter-key/rotate")
@limiter.limit("5/minute;15/hour")
async def rotate_openrouter_key(request: Request, key_request: OpenRouterKeyRequest,
    current_user=Depends(get_current_user)
) -> OpenRouterKeyResponse:
    """
    Rotate the user's OpenRouter API key.
    Revokes the old key and saves the new one with fresh 90-day expiry.
    Increments rotation_count for audit purposes.
    """
    key = key_request.key.strip()

    # Basic format validation
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    if not key.startswith("sk-or-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid key format. OpenRouter keys start with 'sk-or-'"
        )

    db = get_supabase_with_auth(current_user["access_token"])

    # Get current key info for rotation_count
    try:
        current_key = db.table("user_api_keys").select(
            "rotation_count, key_suffix"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception:
        current_key = None

    current_rotation_count = 0
    old_suffix = None
    if current_key and current_key.data:
        current_rotation_count = current_key.data.get("rotation_count", 0)
        old_suffix = current_key.data.get("key_suffix")

    # Validate new key with OpenRouter
    is_valid = await validate_openrouter_key(key)
    if not is_valid:
        log_api_key_event(
            current_user["id"],
            "validation_failed",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"reason": "OpenRouter validation failed during rotation"}
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenRouter API key. Please check it's copied correctly and has credits."
        )

    # Encrypt new key
    encrypted = encrypt_api_key(key, user_id=current_user["id"])
    suffix = get_key_suffix(key)

    # Calculate new expiry date (90 days from now)
    expires_at = datetime.now(timezone.utc) + timedelta(days=KEY_EXPIRY_DAYS)
    new_rotation_count = current_rotation_count + 1

    # Update with new key, increment rotation count, reset expiry
    db.table("user_api_keys").upsert({
        "user_id": current_user["id"],
        "encrypted_key": encrypted,
        "key_suffix": suffix,
        "is_valid": True,
        "is_active": True,
        "expires_at": expires_at.isoformat(),
        "revoked_at": None,
        "rotation_count": new_rotation_count,
        "last_validated_at": "now()"
    }, on_conflict="user_id").execute()

    log_app_event(
        "BYOK_KEY_ROTATED",
        user_id=current_user["id"],
        details={
            "old_suffix": old_suffix,
            "new_suffix": suffix,
            "rotation_count": new_rotation_count
        }
    )

    # Audit log
    log_api_key_event(
        current_user["id"],
        "rotated",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={
            "old_suffix": old_suffix,
            "new_suffix": suffix,
            "rotation_count": new_rotation_count,
            "expires_at": expires_at.isoformat()
        }
    )

    return OpenRouterKeyResponse(
        status="connected",
        masked_key=mask_api_key(key),
        is_valid=True,
        is_active=True,
        expires_at=expires_at.isoformat(),
        days_remaining=KEY_EXPIRY_DAYS,
        rotation_count=new_rotation_count
    )


@router.get("/openrouter-key/expiry")
@limiter.limit("100/minute;500/hour")
async def get_openrouter_key_expiry(request: Request, current_user=Depends(get_current_user)
):
    """
    Get detailed expiry information for the user's API key.
    Useful for showing warnings when key is about to expire.
    """
    expiry_info = await get_key_expiry_info(current_user["id"])

    if not expiry_info:
        raise HTTPException(status_code=404, detail="No API key configured")

    return {
        "expires_at": expiry_info["expires_at"],
        "days_remaining": expiry_info["days_remaining"],
        "is_expired": expiry_info["is_expired"],
        "is_revoked": expiry_info["is_revoked"],
        "last_used_at": expiry_info["last_used_at"],
        "rotation_count": expiry_info["rotation_count"],
        "should_rotate": (
            expiry_info["days_remaining"] is not None and
            expiry_info["days_remaining"] <= 14  # Warn 2 weeks before expiry
        )
    }


@router.get("")
@limiter.limit("100/minute;500/hour")
async def get_user_settings(request: Request, current_user=Depends(get_current_user)
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
    except Exception:
        settings_result = None

    default_mode = "full_council"
    if settings_result and settings_result.data:
        default_mode = settings_result.data.get("default_mode", "full_council")

    # Get API key status
    try:
        key_result = db.table("user_api_keys").select(
            "encrypted_key, key_suffix, is_valid, is_active"
        ).eq("user_id", current_user["id"]).maybe_single().execute()
    except Exception:
        key_result = None

    api_key_status = None
    has_api_key = False

    if key_result and key_result.data:
        has_api_key = True
        # SECURITY: Use per-user derived key for decryption
        try:
            raw_key = decrypt_api_key(key_result.data["encrypted_key"], user_id=current_user["id"])
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
@limiter.limit("30/minute;100/hour")
async def update_user_settings(request: Request, settings_request: UpdateSettingsRequest,
    current_user=Depends(get_current_user)
) -> UserSettingsResponse:
    """
    Update user settings.
    """
    db = get_supabase_with_auth(current_user["access_token"])

    updates = {}
    if settings_request.default_mode:
        if settings_request.default_mode not in ("quick", "full_council"):
            raise HTTPException(
                status_code=400,
                detail="Invalid mode. Must be 'quick' or 'full_council'"
            )
        updates["default_mode"] = settings_request.default_mode

    if updates:
        # Upsert settings
        db.table("user_settings").upsert({
            "user_id": current_user["id"],
            **updates
        }, on_conflict="user_id").execute()

    # Return updated settings
    return await get_user_settings(current_user)
