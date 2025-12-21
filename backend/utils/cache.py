"""
Simple in-memory cache with TTL support.

Provides per-user caching for frequently accessed data like:
- Departments list
- Company context
- User settings

Thread-safe implementation using asyncio locks.
"""

import asyncio
import time
from typing import Any, Dict, Optional, Callable, TypeVar
from functools import wraps

T = TypeVar('T')


class TTLCache:
    """
    Simple TTL-based cache with automatic expiration.

    Features:
    - Per-key TTL
    - Automatic cleanup on access
    - Thread-safe with asyncio locks
    - Optional max size with LRU eviction
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """
        Initialize cache.

        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
            max_size: Maximum number of entries (default: 1000)
        """
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = asyncio.Lock()
        self._access_order: list[str] = []

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        async with self._lock:
            if key not in self._cache:
                return None

            value, expires_at = self._cache[key]

            if time.time() > expires_at:
                # Expired - remove and return None
                del self._cache[key]
                if key in self._access_order:
                    self._access_order.remove(key)
                return None

            # Update access order for LRU
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)

            return value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with optional custom TTL."""
        async with self._lock:
            # Evict oldest entries if at max size
            while len(self._cache) >= self._max_size and self._access_order:
                oldest_key = self._access_order.pop(0)
                self._cache.pop(oldest_key, None)

            expires_at = time.time() + (ttl if ttl is not None else self._default_ttl)
            self._cache[key] = (value, expires_at)

            # Update access order
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)

    async def delete(self, key: str) -> bool:
        """Delete a key from cache. Returns True if key existed."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                if key in self._access_order:
                    self._access_order.remove(key)
                return True
            return False

    async def clear(self) -> None:
        """Clear all cached entries."""
        async with self._lock:
            self._cache.clear()
            self._access_order.clear()

    async def clear_prefix(self, prefix: str) -> int:
        """Clear all entries with keys starting with prefix. Returns count cleared."""
        async with self._lock:
            keys_to_delete = [k for k in self._cache if k.startswith(prefix)]
            for key in keys_to_delete:
                del self._cache[key]
                if key in self._access_order:
                    self._access_order.remove(key)
            return len(keys_to_delete)

    def stats(self) -> Dict[str, int]:
        """Return cache statistics."""
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "default_ttl": self._default_ttl,
        }


# Global cache instances for different data types
# Short TTL for user-specific data that changes frequently
user_cache = TTLCache(default_ttl=60, max_size=500)  # 1 minute TTL

# Longer TTL for company-level data that changes less often
company_cache = TTLCache(default_ttl=300, max_size=200)  # 5 minute TTL

# Very short TTL for settings (may be updated frequently)
settings_cache = TTLCache(default_ttl=30, max_size=500)  # 30 second TTL


def cache_key(prefix: str, *args) -> str:
    """Generate a cache key from prefix and arguments."""
    parts = [prefix] + [str(arg) for arg in args if arg is not None]
    return ":".join(parts)


async def cached(
    cache: TTLCache,
    key: str,
    fetch_fn: Callable[[], Any],
    ttl: Optional[int] = None
) -> Any:
    """
    Get value from cache or fetch and cache it.

    Args:
        cache: Cache instance to use
        key: Cache key
        fetch_fn: Async function to call if cache miss
        ttl: Optional custom TTL

    Returns:
        Cached or freshly fetched value
    """
    # Try cache first
    value = await cache.get(key)
    if value is not None:
        return value

    # Cache miss - fetch and store
    if asyncio.iscoroutinefunction(fetch_fn):
        value = await fetch_fn()
    else:
        value = fetch_fn()

    if value is not None:
        await cache.set(key, value, ttl)

    return value


async def invalidate_user_cache(user_id: str) -> None:
    """Invalidate all cache entries for a specific user."""
    await user_cache.clear_prefix(f"user:{user_id}")
    await settings_cache.clear_prefix(f"settings:{user_id}")


async def invalidate_company_cache(company_id: str) -> None:
    """Invalidate all cache entries for a specific company."""
    await company_cache.clear_prefix(f"company:{company_id}")
    await user_cache.clear_prefix(f"deps:{company_id}")
