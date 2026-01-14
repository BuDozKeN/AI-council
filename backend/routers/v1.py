"""
API v1 Router

Aggregates all API endpoints under the /api/v1 version prefix.
This provides a stable, versioned API for clients.
"""

from fastapi import APIRouter, Request

from .. import model_registry

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
from .company import router as company_router
from .settings import router as settings_router
from .conversations import router as conversations_router
from .projects import router as projects_router
from .billing import router as billing_router
from .knowledge import router as knowledge_router
from .attachments import router as attachments_router
from .leaderboard import router as leaderboard_router
from .dev_settings import router as dev_settings_router
from .ai_utils import router as ai_utils_router
from .profile import router as profile_router


# Create v1 router that aggregates all endpoints
v1_router = APIRouter()

# Include all routers
# Each router has its own prefix (e.g., /conversations, /billing, /company)
# They will be mounted under /api/v1, resulting in /api/v1/conversations, etc.
v1_router.include_router(company_router)
v1_router.include_router(settings_router)
v1_router.include_router(conversations_router)
v1_router.include_router(projects_router)
v1_router.include_router(billing_router)
v1_router.include_router(knowledge_router)
v1_router.include_router(attachments_router)
v1_router.include_router(leaderboard_router)
v1_router.include_router(dev_settings_router)
v1_router.include_router(ai_utils_router)
v1_router.include_router(profile_router)


# =============================================================================
# PUBLIC ENDPOINTS (no authentication required)
# =============================================================================

def _extract_provider(model_id: str) -> str:
    """
    Extract provider from model ID (e.g., 'openai/gpt-4o' -> 'openai').
    Normalizes provider names for frontend consistency.
    """
    provider = model_id.split('/')[0] if '/' in model_id else model_id
    # Normalize provider names to match frontend expectations
    provider_map = {
        'x-ai': 'xai',           # x-ai -> xai (frontend uses 'xai')
        'moonshotai': 'moonshot', # moonshotai -> moonshot (frontend uses 'moonshot')
    }
    return provider_map.get(provider, provider)


@v1_router.get("/council-stats", tags=["public"])
@limiter.limit("100/minute;500/hour")
async def get_council_stats(request: Request, company_id: str | None = None):
    """
    Get public council configuration stats for the landing page.
    Returns the number of AIs in each stage and list of active providers
    (no authentication required).

    This endpoint is intentionally public to allow the landing page
    to display accurate, dynamic stats without requiring login.

    Args:
        company_id: Optional company ID to get company-specific model counts.
                   If not provided, returns global/default model counts.
    """
    # Fetch model counts from the model registry
    # If company_id provided, get company-specific models; otherwise global
    council_members = await model_registry.get_models('council_member', company_id)
    stage2_reviewers = await model_registry.get_models('stage2_reviewer', company_id)
    chairman_models = await model_registry.get_models('chairman', company_id)

    # Collect all unique providers from all stages
    all_models = set(council_members + stage2_reviewers + chairman_models)
    providers = sorted(set(_extract_provider(m) for m in all_models))

    return {
        "stage1_count": len(council_members),  # Number of AIs providing initial responses
        "stage2_count": len(stage2_reviewers),  # Number of AIs doing peer review
        "stage3_count": len(chairman_models),   # Number of chairman models (usually 1 primary + fallbacks)
        "total_rounds": 3,  # Always 3 stages in the council process
        "providers": providers,  # List of unique provider names for carousel
    }
