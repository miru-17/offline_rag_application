"""
Rate limiting.

Authenticated requests are limited per user (JWT subject), so users behind
the same office IP do not block each other. Anonymous requests (login,
register) are limited per IP address.
"""

import hashlib

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.security import TokenError, decode_access_token


def user_or_ip_key(request: Request) -> str:
    api_key = request.headers.get("x-api-key", "")
    if api_key:
        # Each API key has its own limit (never the raw key in memory keys).
        return "key:" + hashlib.sha256(api_key.encode()).hexdigest()[:24]
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            payload = decode_access_token(auth[7:].strip())
            return f"user:{payload['sub']}"
        except TokenError:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=user_or_ip_key)
