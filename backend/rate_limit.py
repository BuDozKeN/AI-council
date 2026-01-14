"""
Shared rate limiting configuration for AI Council.

IMPORTANT: All routers MUST import `limiter` from this module to ensure
rate limits are shared across the entire application. Do NOT create
separate Limiter instances in router files.

Usage in routers:
    from ..rate_limit import limiter

    @router.get("/endpoint")
    @limiter.limit("60/minute")
    async def endpoint(request: Request):
        ...

Features:
- Per-user rate limiting for authenticated requests (by token hash)
- Falls back to IP-based limiting for unauthenticated requests
- Redis storage in production for multi-instance deployments
- In-memory storage for development (single instance)
"""

import hashlib
import logging
import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

logger = logging.getLogger(__name__)


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key from authenticated user ID or fall back to IP address.
    This ensures rate limits are per-user for authenticated requests.
    """
    # Try to get user ID from authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token as identifier (more privacy-preserving)
        token_hash = hashlib.sha256(auth_header[7:].encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    # Fall back to IP address for unauthenticated requests
    return get_remote_address(request)


def _get_storage_uri() -> str | None:
    """
    Get Redis storage URI for rate limiting if available.
    Returns None to use in-memory storage (development/single instance).
    """
    redis_url = os.getenv("REDIS_URL")
    redis_enabled = os.getenv("REDIS_ENABLED", "true").lower() == "true"

    if redis_url and redis_enabled:
        logger.info("Rate limiting: Using Redis storage for distributed rate limiting")
        return redis_url

    logger.info("Rate limiting: Using in-memory storage (single instance only)")
    return None


# Create the shared limiter instance - ALL routers must import this
limiter = Limiter(
    key_func=get_user_identifier,
    storage_uri=_get_storage_uri(),
)
