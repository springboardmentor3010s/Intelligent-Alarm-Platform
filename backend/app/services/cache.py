"""Optional Redis cache adapter.

Active ONLY when `REDIS_URL` is set (decision #2: Redis = thin optional
adapter). When unset (the default), all operations are no-ops so the app
degrades gracefully and no external dependency is required.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL")


class RedisCache:
    """Thin cache abstraction over Redis, active only when REDIS_URL is set."""

    _client = None
    _enabled: bool = bool(REDIS_URL)

    @classmethod
    def enabled(cls) -> bool:
        """Whether the cache is active for this process."""
        if not cls._enabled:
            return False
        if cls._client is None:
            try:
                import redis  # type: ignore

                cls._client = redis.from_url(REDIS_URL, decode_responses=True)
                cls._client.ping()
                logger.info("Redis cache enabled via REDIS_URL.")
            except Exception as e:  # noqa: BLE001
                logger.warning("Redis unavailable (%s); cache disabled.", e)
                cls._enabled = False
                cls._client = None
        return cls._enabled

    @classmethod
    def get(cls, key: str) -> Optional[str]:
        """Return the cached value for key, or None when cache inactive/miss."""
        if not cls.enabled():
            return None
        try:
            return cls._client.get(key)
        except Exception:  # noqa: BLE001
            return None

    @classmethod
    def set(cls, key: str, value: str, ttl_seconds: int = 300) -> bool:
        """Store a value with TTL; no-op when cache inactive."""
        if not cls.enabled():
            return False
        try:
            cls._client.setex(key, ttl_seconds, value)
            return True
        except Exception:  # noqa: BLE001
            return False

    @classmethod
    def delete(cls, key: str) -> bool:
        """Delete a key; no-op when cache inactive."""
        if not cls.enabled():
            return False
        try:
            cls._client.delete(key)
            return True
        except Exception:  # noqa: BLE001
            return False


def get_cache() -> RedisCache:
    """Return the shared cache adapter (module singleton semantics)."""
    return RedisCache
