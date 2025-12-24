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


router = APIRouter(prefix="/api/settings", tags=["dev-settings"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class MockModeRequest(BaseModel):
    """Request to toggle mock mode."""
    enabled: bool


class CachingModeRequest(BaseModel):
    """Request to toggle prompt caching."""
    enabled: bool


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/mock-mode")
async def get_mock_mode(user: dict = Depends(get_current_user)):
    """Get current mock mode status. Requires authentication."""
    from .. import openrouter
    return {
        "enabled": openrouter.MOCK_LLM,
        "scenario": config.MOCK_LLM_SCENARIO
    }


@router.post("/mock-mode")
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
async def get_caching_mode(user: dict = Depends(get_current_user)):
    """Get current prompt caching status. Requires authentication."""
    return {
        "enabled": config.ENABLE_PROMPT_CACHING,
        "supported_models": config.CACHE_SUPPORTED_MODELS
    }


@router.post("/caching-mode")
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
