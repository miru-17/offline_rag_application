import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import CORS_ORIGINS
from app.core.logging import get_logger, setup_logging
from app.core.rate_limit import limiter
from app.routers import users
from app.routers.api_keys import router as api_keys_router
from app.routers.audit import router as audit_router
from app.routers.auth import router as auth_router
from app.routers.conversations import router as conversations_router
from app.routers.datasets import router as datasets_router
from app.routers.documents import router as documents_router
from app.routers.extraction import router as extraction_router
from app.routers.groups import router as groups_router
from app.routers.insights import router as insights_router
from app.routers.license import router as license_router
from app.routers.query import router as query_router
from app.routers.rag_settings import router as rag_settings_router
from app.routers.reports import router as reports_router
from app.routers.system import router as system_router
from app.services import document_ingestion_service, extraction_service, report_service, retention_service, watch_service

setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Continue uploads / extractions that were interrupted by a restart.
    try:
        resumed = document_ingestion_service.resume_unfinished()
        extraction_service.resume_unfinished()
        if resumed:
            logger.info("Resumed unfinished document processing", extra={"fields": {"documents": resumed}})
    except Exception:
        logger.exception("Could not resume background work")
    try:
        watch_service.start_from_config()
    except Exception:
        logger.exception("Could not start the watched folder")
    retention_service.start()
    report_service.start()
    yield
    report_service.stop()
    watch_service.stop()
    retention_service.stop()


docs_enabled = os.getenv("ENABLE_API_DOCS", "true").lower() == "true"

app = FastAPI(
    title="RAGENTIS",
    description="Self-hosted, offline document intelligence (RAG) platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    # Never send stack traces or internal details to the browser.
    logger.exception("Unhandled error", extra={"fields": {"path": request.url.path}})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


class SecurityHeadersMiddleware:
    """Plain ASGI middleware (keeps streaming responses and Stop working)."""

    HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                headers += [h for h in self.HEADERS if h[0] not in present]
                if b"cache-control" not in present:
                    headers.append((b"cache-control", b"no-store"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


app.add_middleware(SecurityHeadersMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

for router in (
    auth_router,
    documents_router,
    query_router,
    license_router,
    conversations_router,
    users.router,
    rag_settings_router,
    system_router,
    audit_router,
    groups_router,
    insights_router,
    datasets_router,
    extraction_router,
    api_keys_router,
    reports_router,
):
    app.include_router(router)


@app.get("/")
def root():
    return {"message": "RAGENTIS API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
