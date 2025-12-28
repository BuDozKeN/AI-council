"""
Company Router - Main Router

Combines all company sub-routers into a single router for inclusion in main.py.
"""

from fastapi import APIRouter

from .overview import router as overview_router
from .team import router as team_router
from .playbooks import router as playbooks_router
from .decisions import router as decisions_router
from .activity import router as activity_router
from .members import router as members_router
from .llm_ops import router as llm_ops_router


# Create the main company router
router = APIRouter()

# Include all sub-routers
# Note: Each sub-router already has prefix="/api/company" so we don't add a prefix here
router.include_router(overview_router)
router.include_router(team_router)
router.include_router(playbooks_router)
router.include_router(decisions_router)
router.include_router(activity_router)
router.include_router(members_router)
router.include_router(llm_ops_router)
