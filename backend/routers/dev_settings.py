"""
Development Settings Router

Endpoints for development/debugging settings:
- Mock mode toggle (development only)
- Prompt caching toggle
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from .. import config

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/settings", tags=["dev-settings"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class MockModeRequest(BaseModel):
    """Request to toggle mock mode."""
    enabled: bool


class CachingModeRequest(BaseModel):
    """Request to toggle prompt caching."""
    enabled: bool


class MockLengthOverrideRequest(BaseModel):
    """Request to set mock length override.

    length_override: None to use LLM Hub settings, or a specific token count
                     (512, 1024, 1536, 2048, 4096, 8192)
    """
    length_override: int | None = None


# Valid mock length values (matching LLM Hub presets)
VALID_MOCK_LENGTHS = {512, 1024, 1536, 2048, 4096, 8192}


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/mock-mode")
@limiter.limit("60/minute;200/hour")
async def get_mock_mode(user: dict = Depends(get_current_user)):
    """Get current mock mode status. Requires authentication."""
    from .. import openrouter
    return {
        "enabled": openrouter.MOCK_LLM,
        "scenario": config.MOCK_LLM_SCENARIO,
        "length_override": config.MOCK_LLM_LENGTH_OVERRIDE,
    }


@router.post("/mock-mode")
@limiter.limit("20/minute;60/hour")
async def set_mock_mode(mock_request: MockModeRequest, user: dict = Depends(get_current_user)):
    """
    Toggle mock mode on/off at runtime. Requires authentication.
    SECURITY: Only allowed in development environment.
    """
    from .. import openrouter

    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production":
        raise HTTPException(
            status_code=403,
            detail="Mock mode cannot be toggled in production environment"
        )

    config.MOCK_LLM = mock_request.enabled

    if mock_request.enabled:
        try:
            from ..mock_llm import generate_mock_response, generate_mock_response_stream
            openrouter.MOCK_LLM = True
            openrouter.generate_mock_response = generate_mock_response
            openrouter.generate_mock_response_stream = generate_mock_response_stream
        except ImportError as e:
            return {"success": False, "error": f"Failed to load mock module: {e}"}
    else:
        openrouter.MOCK_LLM = False

    return {
        "success": True,
        "enabled": openrouter.MOCK_LLM,
        "message": f"Mock mode {'enabled' if mock_request.enabled else 'disabled'}"
    }


@router.get("/caching-mode")
@limiter.limit("60/minute;200/hour")
async def get_caching_mode(user: dict = Depends(get_current_user)):
    """Get current prompt caching status. Requires authentication."""
    return {
        "enabled": config.ENABLE_PROMPT_CACHING,
        "supported_models": config.CACHE_SUPPORTED_MODELS
    }


@router.post("/caching-mode")
@limiter.limit("20/minute;60/hour")
async def set_caching_mode(request: CachingModeRequest, user: dict = Depends(get_current_user)):
    """
    Toggle prompt caching on/off at runtime. Requires authentication.
    """
    config.ENABLE_PROMPT_CACHING = request.enabled

    return {
        "success": True,
        "enabled": config.ENABLE_PROMPT_CACHING,
        "message": f"Prompt caching {'enabled' if request.enabled else 'disabled'}"
    }


@router.get("/mock-length-override")
@limiter.limit("60/minute;200/hour")
async def get_mock_length_override(user: dict = Depends(get_current_user)):
    """Get current mock length override status. Requires authentication."""
    return {
        "length_override": config.MOCK_LLM_LENGTH_OVERRIDE,
        "valid_values": sorted(VALID_MOCK_LENGTHS),
    }


@router.post("/mock-length-override")
@limiter.limit("20/minute;60/hour")
async def set_mock_length_override(
    request: MockLengthOverrideRequest,
    user: dict = Depends(get_current_user)
):
    """
    Set mock response length override at runtime. Requires authentication.

    When set to None (default), mock responses use the max_tokens from the
    actual LLM Hub configuration. When set to a specific value, mock responses
    will use that length regardless of LLM Hub settings.

    This allows developers to test different response lengths without
    modifying their production LLM Hub configuration.
    """
    # Validate the override value
    if request.length_override is not None and request.length_override not in VALID_MOCK_LENGTHS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid length_override. Must be None or one of: {sorted(VALID_MOCK_LENGTHS)}"
        )

    config.MOCK_LLM_LENGTH_OVERRIDE = request.length_override

    if request.length_override is None:
        message = "Mock length override disabled - using LLM Hub settings"
    else:
        message = f"Mock length override set to {request.length_override} tokens"

    return {
        "success": True,
        "length_override": config.MOCK_LLM_LENGTH_OVERRIDE,
        "message": message,
    }
