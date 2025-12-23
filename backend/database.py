"""Supabase database connection with connection pooling."""

import os
import time
import threading
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional, Dict, Tuple

# Load .env from current dir or parent dir
env_path = Path(__file__).resolve().parent.parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(env_path)

# Supabase configuration (support both SUPABASE_KEY and SUPABASE_ANON_KEY)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")  # Optional: for admin operations

# Supabase client (lazy initialization)
_supabase_client: Client = None
_supabase_service_client: Client = None

# =============================================================================
# Connection Pool for authenticated clients
# =============================================================================
# Cache authenticated clients by token hash to avoid creating new clients per request
# Each entry: (client, created_at)
_auth_client_pool: Dict[str, Tuple[Client, float]] = {}
_pool_lock = threading.Lock()

# Pool configuration
POOL_MAX_SIZE = 100  # Maximum number of cached clients
POOL_TTL = 300  # Client TTL in seconds (5 minutes, matches typical JWT refresh)
POOL_CLEANUP_INTERVAL = 60  # Cleanup expired entries every 60 seconds
_last_cleanup = 0


def _get_token_hash(token: str) -> str:
    """Get a short hash of the token for cache key."""
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()[:16]


def _cleanup_pool():
    """Remove expired entries from the pool."""
    global _last_cleanup
    now = time.time()

    # Only cleanup periodically
    if now - _last_cleanup < POOL_CLEANUP_INTERVAL:
        return

    _last_cleanup = now
    expired_keys = []

    for key, (_, created_at) in _auth_client_pool.items():
        if now - created_at > POOL_TTL:
            expired_keys.append(key)

    for key in expired_keys:
        _auth_client_pool.pop(key, None)

    # If still over max size, remove oldest entries
    if len(_auth_client_pool) > POOL_MAX_SIZE:
        sorted_entries = sorted(_auth_client_pool.items(), key=lambda x: x[1][1])
        for key, _ in sorted_entries[:len(_auth_client_pool) - POOL_MAX_SIZE]:
            _auth_client_pool.pop(key, None)


def get_supabase() -> Client:
    """Get or create the Supabase client (anon key - subject to RLS)."""
    global _supabase_client

    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
                "Add them to your .env file."
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    return _supabase_client


def get_supabase_service() -> Optional[Client]:
    """
    Get or create the Supabase service client (bypasses RLS).
    Used for admin operations like webhooks.
    Returns None if service key is not configured.
    """
    global _supabase_service_client

    if _supabase_service_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return None
        _supabase_service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    return _supabase_service_client


def get_supabase_with_auth(access_token: str) -> Client:
    """
    Get or create a Supabase client authenticated with a user's JWT token.
    Uses connection pooling to reuse clients for the same token.
    This client will respect RLS policies using the user's identity.

    Args:
        access_token: The user's JWT access token from Supabase Auth

    Returns:
        Authenticated Supabase client
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
            "Add them to your .env file."
        )

    token_hash = _get_token_hash(access_token)
    now = time.time()

    with _pool_lock:
        # Cleanup expired entries periodically
        _cleanup_pool()

        # Check if we have a cached client for this token
        if token_hash in _auth_client_pool:
            client, created_at = _auth_client_pool[token_hash]
            # Check if still valid (not expired)
            if now - created_at < POOL_TTL:
                return client
            else:
                # Expired, remove it
                del _auth_client_pool[token_hash]

        # Create a new client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Set the auth header to use the user's token
        # This makes auth.uid() return the user's ID in RLS policies
        client.postgrest.auth(access_token)

        # Also set auth for storage operations
        # The storage client needs the Authorization header set
        client.storage._client.headers["Authorization"] = f"Bearer {access_token}"

        # Cache the client
        _auth_client_pool[token_hash] = (client, now)

        return client


def is_supabase_configured() -> bool:
    """Check if Supabase is configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY)
