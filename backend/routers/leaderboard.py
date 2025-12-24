"""
Leaderboard Router

Endpoints for model rankings:
- Get overall leaderboard summary
- Get overall model rankings
- Get department-specific leaderboard
"""

from fastapi import APIRouter, Depends, Request

from ..auth import get_current_user
from .. import leaderboard

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
@limiter.limit("60/minute")
async def get_leaderboard_summary(request: Request, user: dict = Depends(get_current_user)):
    """Get full leaderboard summary with overall and per-department rankings."""
    return leaderboard.get_leaderboard_summary()


@router.get("/overall")
@limiter.limit("60/minute")
async def get_overall_leaderboard(request: Request, user: dict = Depends(get_current_user)):
    """Get overall model leaderboard across all sessions."""
    return leaderboard.get_overall_leaderboard()


@router.get("/department/{department}")
@limiter.limit("60/minute")
async def get_department_leaderboard(request: Request, department: str, user: dict = Depends(get_current_user)):
    """Get leaderboard for a specific department."""
    return leaderboard.get_department_leaderboard(department)
