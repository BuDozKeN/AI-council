"""
Shared rate limiting configuration for AI Council.
Imported by main.py and routers to avoid circular imports.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key from authenticated user ID or fall back to IP address.
    This ensures rate limits are per-user for authenticated requests.
    """
    # Try to get user ID from authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token as identifier (more privacy-preserving)
        import hashlib
        token_hash = hashlib.sha256(auth_header[7:].encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    # Fall back to IP address for unauthenticated requests
    return get_remote_address(request)


# Create the shared limiter instance
limiter = Limiter(key_func=get_user_identifier)
