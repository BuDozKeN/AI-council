"""Redis caching layer for OpenRouter responses and rate limiting.

This module provides:
1. Response caching - Cache identical queries to save money
2. Rate limiting - Per-user/company query limits (replaces in-memory slowapi)
3. Session caching - Fast auth token validation

SETUP:
- Development: docker run -d -p 6379:6379 redis
- Production: Use managed Redis (Render, Railway, Upstash)

GRACEFUL DEGRADATION:
- All cache operations fail silently if Redis is unavailable
- The app continues to work, just without caching benefits
"""

import hashlib
import json
import asyncio
from typing import Optional, Any, Dict
from functools import wraps

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

# Import config (will be added in next step)
try:
    from .config import REDIS_URL, REDIS_ENABLED, REDIS_DEFAULT_TTL
except ImportError:
    from backend.config import REDIS_URL, REDIS_ENABLED, REDIS_DEFAULT_TTL


# =============================================================================
# CONNECTION MANAGEMENT
# =============================================================================

_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> Optional[redis.Redis]:
    """
    Get or create Redis client with connection pooling.

    Returns None if Redis is disabled or unavailable (graceful degradation).
    """
    global _redis_pool, _redis_client

    if not REDIS_ENABLED:
        return None

    if _redis_client is not None:
        try:
            await _redis_client.ping()
            return _redis_client
        except Exception:
            # Connection lost, recreate
            _redis_client = None
            _redis_pool = None

    try:
        if _redis_pool is None:
            _redis_pool = ConnectionPool.from_url(
                REDIS_URL,
                max_connections=20,
                decode_responses=True,  # Return strings instead of bytes
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
            )

        _redis_client = redis.Redis(connection_pool=_redis_pool)
        await _redis_client.ping()  # Verify connection
        return _redis_client

    except Exception as e:
        # Log but don't crash - graceful degradation
        print(f"[CACHE] Redis connection failed: {e}")
        return None


async def close_redis():
    """Close Redis connection pool. Call on app shutdown."""
    global _redis_pool, _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None

    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None


# =============================================================================
# CACHE KEY GENERATION
# =============================================================================

def make_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Generate a deterministic cache key from arguments.

    Args:
        prefix: Cache namespace (e.g., "llm", "session", "rate")
        *args: Positional arguments to include in key
        **kwargs: Keyword arguments to include in key

    Returns:
        Cache key like "axcouncil:llm:abc123def456"
    """
    # Create deterministic hash of all arguments
    key_data = json.dumps({
        "args": args,
        "kwargs": kwargs,
    }, sort_keys=True, default=str)

    key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:16]

    return f"axcouncil:{prefix}:{key_hash}"


def make_llm_cache_key(
    company_id: str,
    model: str,
    messages_hash: str,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> str:
    """
    Generate cache key for LLM response.

    The key includes all parameters that affect the response:
    - company_id: Different companies should not share cache
    - model: Different models give different responses
    - messages_hash: Hash of the full message array
    - temperature: Different temps = different responses
    - max_tokens: Different limits = potentially different responses
    """
    return make_cache_key(
        "llm",
        company_id=company_id,
        model=model,
        messages=messages_hash,
        temp=temperature,
        max_tokens=max_tokens,
    )


def hash_messages(messages: list) -> str:
    """Create a hash of the messages array for cache key."""
    messages_json = json.dumps(messages, sort_keys=True, default=str)
    return hashlib.sha256(messages_json.encode()).hexdigest()[:32]


# =============================================================================
# RESPONSE CACHING
# =============================================================================

async def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached LLM response if available.

    Args:
        cache_key: Key from make_llm_cache_key()

    Returns:
        Cached response dict, or None if not cached
    """
    client = await get_redis()
    if not client:
        return None

    try:
        cached = await client.get(cache_key)
        if cached:
            return json.loads(cached)
        return None
    except Exception as e:
        print(f"[CACHE] Get failed: {e}")
        return None


async def set_cached_response(
    cache_key: str,
    response: Dict[str, Any],
    ttl: Optional[int] = None,
) -> bool:
    """
    Cache an LLM response.

    Args:
        cache_key: Key from make_llm_cache_key()
        response: Response dict to cache
        ttl: Time-to-live in seconds (default: REDIS_DEFAULT_TTL)

    Returns:
        True if cached successfully, False otherwise
    """
    client = await get_redis()
    if not client:
        return False

    try:
        ttl = ttl or REDIS_DEFAULT_TTL
        await client.setex(
            cache_key,
            ttl,
            json.dumps(response, default=str),
        )
        return True
    except Exception as e:
        print(f"[CACHE] Set failed: {e}")
        return False


async def invalidate_cache(pattern: str) -> int:
    """
    Invalidate cache entries matching a pattern.

    Args:
        pattern: Redis pattern (e.g., "axcouncil:llm:*" for all LLM cache)

    Returns:
        Number of keys deleted
    """
    client = await get_redis()
    if not client:
        return 0

    try:
        keys = []
        async for key in client.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            return await client.delete(*keys)
        return 0
    except Exception as e:
        print(f"[CACHE] Invalidate failed: {e}")
        return 0


# =============================================================================
# RATE LIMITING
# =============================================================================

async def check_rate_limit(
    key: str,
    limit: int,
    window_seconds: int = 60,
) -> tuple[bool, int, int]:
    """
    Check and increment rate limit counter using sliding window.

    Args:
        key: Unique identifier (e.g., "user:123" or "company:456")
        limit: Maximum requests allowed in window
        window_seconds: Time window in seconds

    Returns:
        Tuple of (allowed: bool, current_count: int, seconds_until_reset: int)
    """
    client = await get_redis()
    if not client:
        # If Redis unavailable, allow request (fail open)
        return (True, 0, 0)

    rate_key = f"axcouncil:rate:{key}"

    try:
        pipe = client.pipeline()

        # Increment counter
        pipe.incr(rate_key)
        # Set expiry only if key is new
        pipe.expire(rate_key, window_seconds, nx=True)
        # Get TTL
        pipe.ttl(rate_key)

        results = await pipe.execute()
        current_count = results[0]
        ttl = results[2]

        allowed = current_count <= limit
        seconds_until_reset = max(0, ttl) if ttl > 0 else window_seconds

        return (allowed, current_count, seconds_until_reset)

    except Exception as e:
        print(f"[CACHE] Rate limit check failed: {e}")
        return (True, 0, 0)  # Fail open


async def get_rate_limit_status(key: str) -> Dict[str, Any]:
    """Get current rate limit status for a key."""
    client = await get_redis()
    if not client:
        return {"available": True, "count": 0, "ttl": 0}

    rate_key = f"axcouncil:rate:{key}"

    try:
        pipe = client.pipeline()
        pipe.get(rate_key)
        pipe.ttl(rate_key)
        results = await pipe.execute()

        count = int(results[0]) if results[0] else 0
        ttl = results[1] if results[1] > 0 else 0

        return {
            "available": True,
            "count": count,
            "ttl": ttl,
        }
    except Exception:
        return {"available": False, "count": 0, "ttl": 0}


# =============================================================================
# SESSION CACHING
# =============================================================================

async def cache_session(
    session_id: str,
    user_data: Dict[str, Any],
    ttl: int = 3600,  # 1 hour default
) -> bool:
    """Cache user session data for fast auth checks."""
    client = await get_redis()
    if not client:
        return False

    session_key = f"axcouncil:session:{session_id}"

    try:
        await client.setex(
            session_key,
            ttl,
            json.dumps(user_data, default=str),
        )
        return True
    except Exception:
        return False


async def get_cached_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get cached session data."""
    client = await get_redis()
    if not client:
        return None

    session_key = f"axcouncil:session:{session_id}"

    try:
        data = await client.get(session_key)
        if data:
            return json.loads(data)
        return None
    except Exception:
        return None


async def invalidate_session(session_id: str) -> bool:
    """Invalidate a session (on logout)."""
    client = await get_redis()
    if not client:
        return False

    session_key = f"axcouncil:session:{session_id}"

    try:
        await client.delete(session_key)
        return True
    except Exception:
        return False


# =============================================================================
# HEALTH CHECK
# =============================================================================

async def get_cache_health() -> Dict[str, Any]:
    """
    Get Redis health status for monitoring.

    Returns:
        Health status dict with connection info
    """
    if not REDIS_ENABLED:
        return {
            "enabled": False,
            "connected": False,
            "message": "Redis caching is disabled",
        }

    client = await get_redis()
    if not client:
        return {
            "enabled": True,
            "connected": False,
            "message": "Redis connection failed",
        }

    try:
        info = await client.info("server")
        memory = await client.info("memory")

        return {
            "enabled": True,
            "connected": True,
            "version": info.get("redis_version", "unknown"),
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "used_memory_human": memory.get("used_memory_human", "unknown"),
            "connected_clients": info.get("connected_clients", 0),
        }
    except Exception as e:
        return {
            "enabled": True,
            "connected": False,
            "message": str(e),
        }


# =============================================================================
# DECORATOR FOR CACHED FUNCTIONS
# =============================================================================

def cached(
    prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[callable] = None,
):
    """
    Decorator to cache async function results.

    Usage:
        @cached("my_func", ttl=300)
        async def expensive_operation(arg1, arg2):
            ...

    Args:
        prefix: Cache key prefix
        ttl: Time-to-live in seconds
        key_builder: Optional function to build cache key from args
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = make_cache_key(prefix, *args, **kwargs)

            # Try to get from cache
            client = await get_redis()
            if client:
                try:
                    cached_result = await client.get(cache_key)
                    if cached_result:
                        return json.loads(cached_result)
                except Exception:
                    pass

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            if client and result is not None:
                try:
                    await client.setex(
                        cache_key,
                        ttl or REDIS_DEFAULT_TTL,
                        json.dumps(result, default=str),
                    )
                except Exception:
                    pass

            return result

        return wrapper
    return decorator
