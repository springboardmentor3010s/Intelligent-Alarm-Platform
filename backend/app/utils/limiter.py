import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Allow disabling rate limiting during automated test suite execution via TESTING=true
is_testing = os.getenv("TESTING", "").strip().lower() in ("true", "1")

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    enabled=not is_testing,
)
