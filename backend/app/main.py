
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from slowapi import Limiter  # type: ignore[import-not-found]
    from slowapi.errors import RateLimitExceeded  # type: ignore[import-not-found]
    from slowapi.util import get_remote_address  # type: ignore[import-not-found]
    from slowapi import _rate_limit_exceeded_handler  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - optional dependency fallback
    class RateLimitExceeded(Exception):
        """Fallback exception used when slowapi is unavailable."""

    def get_remote_address(request):
        return request.client.host if request and request.client else "127.0.0.1"

    class Limiter:
        def __init__(self, key_func=None, *args, **kwargs):
            self.key_func = key_func

        def limit(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

    def _rate_limit_exceeded_handler(request, exc):
        return {"detail": "Rate limit exceeded"}

from app.routers import users

from app.routers.auth import router as auth_router
from app.routers.documents import router as documents_router
from app.routers.query import router as query_router
from app.routers.license import router as license_router
from app.routers.conversations import (
    router as conversations_router,
)
from app.routers.rag_settings import (
    router as rag_settings_router,
)
from app.routers.system import (
    router as system_router,
)


# ============================================================
# RATE LIMITER
# ============================================================

limiter = Limiter(
    key_func=get_remote_address
)


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Offline RAG Application",
    description=(
        "Self-hosted offline "
        "Retrieval-Augmented Generation system"
    ),
    version="1.0.0",
)


# ============================================================
# RATE LIMITER CONFIGURATION
# ============================================================

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# INCLUDE ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(query_router)
app.include_router(license_router)
app.include_router(conversations_router)
app.include_router(users.router)
app.include_router(rag_settings_router)
app.include_router(system_router)


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Offline RAG Application API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }

