"""
API v1 Router

Aggregates all API endpoints under the /api/v1 version prefix.
This provides a stable, versioned API for clients.
"""

from fastapi import APIRouter

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
