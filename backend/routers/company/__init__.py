# Company routers package
# Provides sub-routers for company-related endpoints

from .utils import (
    get_client,
    get_service_client,
    verify_company_access,
    resolve_company_id,
    generate_decision_summary_internal,
    auto_regenerate_project_context,
    log_activity,
    log_usage_event,
    UUID_PATTERN,
    SAFE_ID_PATTERN,
    ValidCompanyId,
    ValidDeptId,
    ValidRoleId,
    ValidPlaybookId,
    ValidDecisionId,
    ValidProjectId,
    _company_uuid_cache,
    _CACHE_TTL,
)

from .overview import router as overview_router
from .team import router as team_router
from .playbooks import router as playbooks_router
from .decisions import router as decisions_router
from .activity import router as activity_router
from .members import router as members_router

# Combined router for main.py inclusion
from .router import router

__all__ = [
    # Main combined router
    'router',
    # Utility functions (for use by other modules)
    'get_client',
    'get_service_client',
    'verify_company_access',
    'resolve_company_id',
    'generate_decision_summary_internal',
    'auto_regenerate_project_context',
    'log_activity',
    'log_usage_event',
    # Sub-routers (for direct access if needed)
    'overview_router',
    'team_router',
    'playbooks_router',
    'decisions_router',
    'activity_router',
    'members_router',
]
