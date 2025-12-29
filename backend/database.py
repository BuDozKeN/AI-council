"""Supabase database connection with connection pooling."""

import os
import time
import asyncio
import threading
import random
import logging
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional, Dict, Tuple, TypeVar, Callable, Any

T = TypeVar('T')
logger = logging.getLogger(__name__)

# =============================================================================
# DATABASE QUERY TIMEOUT
# =============================================================================
# Default timeout for database queries to prevent hung connections
DEFAULT_DB_TIMEOUT = 10.0  # 10 seconds


class DatabaseTimeoutError(Exception):
    """Raised when a database query exceeds the timeout."""
    def __init__(self, timeout: float, operation: str = "query"):
        self.timeout = timeout
        self.operation = operation
        super().__init__(
            f"Database {operation} timed out after {timeout}s. "
            f"The database may be overloaded or the query is too complex."
        )


async def with_timeout(
    coro_or_func: Callable[[], T],
    timeout: float = DEFAULT_DB_TIMEOUT,
    operation: str = "query"
) -> T:
    """
    Execute a database operation with a timeout.

    Args:
        coro_or_func: Coroutine or sync function to execute
        timeout: Timeout in seconds (default: 10s)
        operation: Description of the operation for error messages

    Returns:
        Result of the operation

    Raises:
        DatabaseTimeoutError: If the operation exceeds the timeout
    """
    try:
        # Check if it's a coroutine
        if asyncio.iscoroutine(coro_or_func):
            return await asyncio.wait_for(coro_or_func, timeout=timeout)
        elif asyncio.iscoroutinefunction(coro_or_func):
            return await asyncio.wait_for(coro_or_func(), timeout=timeout)
        else:
            # Sync function - run in executor with timeout
            loop = asyncio.get_event_loop()
            return await asyncio.wait_for(
                loop.run_in_executor(None, coro_or_func),
                timeout=timeout
            )
    except asyncio.TimeoutError:
        raise DatabaseTimeoutError(timeout, operation)


# =============================================================================
# DATABASE RETRY LOGIC
# =============================================================================
# Retry configuration for transient database failures
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 0.5  # 500ms
DEFAULT_MAX_DELAY = 5.0  # 5 seconds
DEFAULT_JITTER = 0.3  # 30% jitter

# Transient error indicators (substrings to match in error messages)
TRANSIENT_ERRORS = [
    "connection",
    "timeout",
    "too many clients",
    "temporarily unavailable",
    "network",
    "ECONNRESET",
    "ETIMEDOUT",
    "socket",
    "refused",
    "503",
    "502",
    "504",
]


class DatabaseRetryError(Exception):
    """Raised when all database retry attempts fail."""
    def __init__(self, attempts: int, last_error: Exception, operation: str = "query"):
        self.attempts = attempts
        self.last_error = last_error
        self.operation = operation
        super().__init__(
            f"Database {operation} failed after {attempts} attempts. "
            f"Last error: {last_error}"
        )


def _is_transient_error(error: Exception) -> bool:
    """Check if an error is transient and worth retrying."""
    error_str = str(error).lower()
    return any(indicator in error_str for indicator in TRANSIENT_ERRORS)


def _calculate_delay(attempt: int, base_delay: float, max_delay: float, jitter: float) -> float:
    """Calculate delay with exponential backoff and jitter."""
    exponential_delay = min(max_delay, base_delay * (2 ** attempt))
    jitter_min = exponential_delay * (1 - jitter)
    jitter_max = exponential_delay * (1 + jitter)
    return random.uniform(jitter_min, jitter_max)


async def with_retry(
    func: Callable[[], T],
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    jitter: float = DEFAULT_JITTER,
    operation: str = "query",
    timeout: Optional[float] = DEFAULT_DB_TIMEOUT,
) -> T:
    """
    Execute a database operation with retry logic for transient failures.

    Uses exponential backoff with jitter to prevent thundering herd.
    Only retries on transient errors (connection issues, timeouts, etc).

    Args:
        func: Function to execute (sync or async)
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds for exponential backoff
        max_delay: Maximum delay between retries
        jitter: Jitter factor (0.3 = ±30% randomization)
        operation: Description of the operation for logging
        timeout: Timeout per attempt (None to disable)

    Returns:
        Result of the operation

    Raises:
        DatabaseRetryError: If all retry attempts fail
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            # Apply timeout if specified
            if timeout:
                return await with_timeout(func, timeout=timeout, operation=operation)
            elif asyncio.iscoroutinefunction(func):
                return await func()
            elif asyncio.iscoroutine(func):
                return await func
            else:
                return func()

        except DatabaseTimeoutError:
            # Timeouts are transient - retry them
            last_error = DatabaseTimeoutError(timeout or DEFAULT_DB_TIMEOUT, operation)
            logger.warning(
                f"Database {operation} timeout (attempt {attempt + 1}/{max_retries + 1})"
            )

        except Exception as e:
            last_error = e

            # Only retry transient errors
            if not _is_transient_error(e):
                logger.error(f"Database {operation} failed with non-transient error: {e}")
                raise

            logger.warning(
                f"Database {operation} transient error (attempt {attempt + 1}/{max_retries + 1}): {e}"
            )

        # Don't sleep after the last attempt
        if attempt < max_retries:
            delay = _calculate_delay(attempt, base_delay, max_delay, jitter)
            logger.debug(f"Retrying {operation} in {delay:.2f}s")
            await asyncio.sleep(delay)

    # All retries exhausted
    raise DatabaseRetryError(max_retries + 1, last_error, operation)


# Load .env from current dir or parent dir
env_path = Path(__file__).resolve().parent.parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(env_path)

# Supabase configuration (support both SUPABASE_KEY and SUPABASE_ANON_KEY)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

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
