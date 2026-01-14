"""
Profile Router

Endpoints for user profile management:
- Get user profile
- Update user profile
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import get_current_user
from .. import storage
from ..security import SecureHTTPException, log_app_event

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/profile", tags=["profile"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ProfileUpdateRequest(BaseModel):
    """Request to update user profile."""
    display_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
@limiter.limit("100/minute;500/hour")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's profile."""
    try:
        log_app_event("PROFILE: Fetching profile", user_id=user['id'])
        profile = storage.get_user_profile(user["id"], user.get("access_token"))
        return profile or {
            "display_name": "",
            "company": "",
            "phone": "",
            "bio": "",
        }
    except Exception as e:
        log_app_event(f"PROFILE: Get profile failed: {type(e).__name__}", user_id=user['id'], level="ERROR")
        raise SecureHTTPException.internal_error(str(e))


@router.put("")
@limiter.limit("30/minute;100/hour")
async def update_profile(request: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    """Update current user's profile."""
    try:
        log_app_event("PROFILE: Updating profile", user_id=user['id'])
        profile_data = {
            "display_name": request.display_name,
            "company": request.company,
            "phone": request.phone,
            "bio": request.bio,
        }
        result = storage.update_user_profile(user["id"], profile_data, user.get("access_token"))
        if not result:
            raise HTTPException(status_code=500, detail="Failed to update profile - storage returned None")
        log_app_event("PROFILE: Profile updated successfully", user_id=user['id'])
        return {"success": True, "profile": result}
    except HTTPException:
        raise
    except Exception as e:
        log_app_event(f"PROFILE: Update profile failed: {type(e).__name__}", user_id=user['id'], level="ERROR")
        raise SecureHTTPException.internal_error(str(e))
