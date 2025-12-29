"""
Simple in-memory cache with TTL support.

Provides per-user caching for frequently accessed data like:
- Departments list
- Company context
- User settings

Thread-safe implementation using asyncio locks.
Includes stampede prevention and hit/miss metrics.
"""

import asyncio
import time
from typing import Any, Dict, Optional, Callable, TypeVar
from functools import wraps
from dataclasses import dataclass, field

T = TypeVar('T')


@dataclass
class CacheMetrics:
    """Tracks cache performance metrics."""
    hits: int = 0
    misses: int = 0
    stampede_waits: int = 0  # Times we waited for another fetch
    evictions: int = 0

    def hit_rate(self) -> float:
        """Calculate cache hit rate as percentage."""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Export metrics as dictionary."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "stampede_waits": self.stampede_waits,
            "evictions": self.evictions,
            "hit_rate_percent": round(self.hit_rate(), 2),
            "total_requests": self.hits + self.misses
        }


class TTLCache:
    """
    Simple TTL-based cache with automatic expiration.

    Features:
    - Per-key TTL
    - Automatic cleanup on access
    - Thread-safe with asyncio locks
    - Optional max size with LRU eviction
    - Stampede prevention with per-key fetch locks
    - Hit/miss metrics tracking
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000, name: str = "default"):
        """
        Initialize cache.

        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
            max_size: Maximum number of entries (default: 1000)
            name: Cache name for metrics identification
        """
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = asyncio.Lock()
        self._access_order: list[str] = []
        self._name = name
        self._metrics = CacheMetrics()
        # Per-key locks for stampede prevention
        self._fetch_locks: Dict[str, asyncio.Lock] = {}
        self._fetch_locks_lock = asyncio.Lock()

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

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics including metrics."""
        return {
            "name": self._name,
            "size": len(self._cache),
            "max_size": self._max_size,
            "default_ttl": self._default_ttl,
            "metrics": self._metrics.to_dict(),
        }

    async def _get_fetch_lock(self, key: str) -> asyncio.Lock:
        """Get or create a per-key lock for stampede prevention."""
        async with self._fetch_locks_lock:
            if key not in self._fetch_locks:
                self._fetch_locks[key] = asyncio.Lock()
            return self._fetch_locks[key]

    async def _cleanup_fetch_lock(self, key: str) -> None:
        """Remove a fetch lock after use to prevent memory leak."""
        async with self._fetch_locks_lock:
            self._fetch_locks.pop(key, None)

    async def get_or_fetch(
        self,
        key: str,
        fetch_fn: Callable[[], Any],
        ttl: Optional[int] = None
    ) -> Any:
        """
        Get value from cache or fetch with stampede prevention.

        If multiple coroutines request the same key simultaneously,
        only one will execute fetch_fn while others wait.

        Args:
            key: Cache key
            fetch_fn: Async or sync function to call on cache miss
            ttl: Optional custom TTL

        Returns:
            Cached or freshly fetched value
        """
        # Fast path: check cache first without fetch lock
        value = await self.get(key)
        if value is not None:
            self._metrics.hits += 1
            return value

        # Slow path: acquire per-key lock to prevent stampede
        fetch_lock = await self._get_fetch_lock(key)

        async with fetch_lock:
            # Double-check after acquiring lock (another coroutine may have populated)
            value = await self.get(key)
            if value is not None:
                self._metrics.hits += 1
                self._metrics.stampede_waits += 1
                return value

            # Actually fetch the value
            self._metrics.misses += 1
            try:
                if asyncio.iscoroutinefunction(fetch_fn):
                    value = await fetch_fn()
                else:
                    value = fetch_fn()

                if value is not None:
                    await self.set(key, value, ttl)

                return value
            finally:
                # Cleanup the fetch lock
                await self._cleanup_fetch_lock(key)


# Global cache instances for different data types
# Short TTL for user-specific data that changes frequently
user_cache = TTLCache(default_ttl=60, max_size=500, name="user")  # 1 minute TTL

# Longer TTL for company-level data that changes less often
company_cache = TTLCache(default_ttl=300, max_size=200, name="company")  # 5 minute TTL

# Very short TTL for settings (may be updated frequently)
settings_cache = TTLCache(default_ttl=30, max_size=500, name="settings")  # 30 second TTL


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
    Get value from cache or fetch and cache it with stampede prevention.

    Uses per-key locking to prevent cache stampede when multiple
    coroutines request the same uncached key simultaneously.

    Args:
        cache: Cache instance to use
        key: Cache key
        fetch_fn: Async function to call if cache miss
        ttl: Optional custom TTL

    Returns:
        Cached or freshly fetched value
    """
    return await cache.get_or_fetch(key, fetch_fn, ttl)


def get_all_cache_metrics() -> Dict[str, Any]:
    """Get metrics from all global cache instances."""
    return {
        "user_cache": user_cache.stats(),
        "company_cache": company_cache.stats(),
        "settings_cache": settings_cache.stats(),
    }


async def invalidate_user_cache(user_id: str) -> None:
    """Invalidate all cache entries for a specific user."""
    await user_cache.clear_prefix(f"user:{user_id}")
    await settings_cache.clear_prefix(f"settings:{user_id}")


async def invalidate_company_cache(company_id: str) -> None:
    """Invalidate all cache entries for a specific company."""
    # Clear company-specific caches with different prefixes
    await company_cache.clear_prefix(f"company:{company_id}")
    await company_cache.clear_prefix(f"overview:{company_id}")
    await company_cache.clear_prefix(f"team:{company_id}")
    await company_cache.clear_prefix(f"playbooks:{company_id}")
    await user_cache.clear_prefix(f"deps:{company_id}")
