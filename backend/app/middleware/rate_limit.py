"""Rate limiting middleware using slowapi with fallback storage."""

import os
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

settings = get_settings()

# Use memory storage if testing or if Redis URL is not set
storage_uri = os.getenv("RATELIMIT_STORAGE_URL")
if not storage_uri:
    storage_uri = settings.REDIS_URL if settings.REDIS_URL and not os.getenv("TESTING") else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    storage_uri=storage_uri,
)
