"""
Central configuration for RAGENTIS.

Every value comes from environment variables (or a local .env file that is
never committed). Secrets have no defaults: the backend refuses to start
when a required secret is missing or too weak.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env(name: str, default: str) -> str:
    """Like os.getenv, but an empty value (e.g. from docker compose "${X:-}") means "use the default"."""
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class ConfigError(RuntimeError):
    """Raised when the backend is started with an unsafe configuration."""


# ------------------------------------------------------------------
# Security
# ------------------------------------------------------------------

MIN_SECRET_LENGTH = 32


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if len(secret) < MIN_SECRET_LENGTH:
        raise ConfigError(
            "JWT_SECRET_KEY is missing or shorter than "
            f"{MIN_SECRET_LENGTH} characters. Generate one with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    return secret


ACCESS_TOKEN_EXPIRE_MINUTES = _int("ACCESS_TOKEN_EXPIRE_MINUTES", 30)

# Public self-registration is off by default. When the database has no users
# yet, the first registration is always allowed and becomes the ADMIN.
ALLOW_SELF_REGISTRATION = _bool("ALLOW_SELF_REGISTRATION", False)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

# ------------------------------------------------------------------
# Rate limits (slowapi syntax)
# ------------------------------------------------------------------

LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "5/minute")
QUERY_RATE_LIMIT = os.getenv("QUERY_RATE_LIMIT", "20/minute")
UPLOAD_RATE_LIMIT = os.getenv("UPLOAD_RATE_LIMIT", "10/minute")
REGISTER_RATE_LIMIT = os.getenv("REGISTER_RATE_LIMIT", "5/minute")

# ------------------------------------------------------------------
# Storage
# ------------------------------------------------------------------

UPLOAD_ROOT = Path(os.getenv("UPLOAD_ROOT", "uploads"))
CHROMA_PATH = Path(os.getenv("CHROMA_PATH", "chroma_db"))

MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 25)
MAX_DATASET_MB = _int("MAX_DATASET_MB", 20)
MAX_DATASET_ROWS = _int("MAX_DATASET_ROWS", 200_000)
MAX_PDF_PAGES = _int("MAX_PDF_PAGES", 500)

# ------------------------------------------------------------------
# Local AI runtime
# ------------------------------------------------------------------

OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    .replace("/api/generate", ""),
).rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_TIMEOUT_SECONDS = _int("OLLAMA_TIMEOUT_SECONDS", 180)
OLLAMA_NUM_CTX = _int("OLLAMA_NUM_CTX", 4096)
# Keep the model loaded in memory between questions (Ollama unloads it after
# 5 minutes by default, and loading it again takes many seconds on a laptop).
OLLAMA_KEEP_ALIVE = _env("OLLAMA_KEEP_ALIVE", "30m")

# Only this many LLM generations run at the same time (CPU laptop).
LLM_MAX_CONCURRENCY = _int("LLM_MAX_CONCURRENCY", 1)
LLM_QUEUE_WAIT_SECONDS = _int("LLM_QUEUE_WAIT_SECONDS", 90)

# Only this many documents are ingested at the same time.
INGESTION_CONCURRENCY = _int("INGESTION_CONCURRENCY", 1)

# ------------------------------------------------------------------
# Licensing
# ------------------------------------------------------------------

LICENSE_PUBLIC_KEY_PATH = Path(
    os.getenv(
        "LICENSE_PUBLIC_KEY_PATH",
        str(Path(__file__).resolve().parent / "license_public_key.pem"),
    )
)

PRODUCT_NAME = "RAGENTIS"

# Extra licence public keys (key rotation): every *.pem in this folder is
# accepted next to LICENSE_PUBLIC_KEY_PATH. Remove a file to retire a key.
LICENSE_KEYS_DIR = Path(os.getenv("LICENSE_KEYS_DIR", str(Path(__file__).resolve().parent / "license_keys")))

# Warn administrators this many days before the licence expires.
LICENSE_WARNING_DAYS = _int("LICENSE_WARNING_DAYS", 30)

# ------------------------------------------------------------------
# Sessions, MFA, directory login
# ------------------------------------------------------------------

REFRESH_TOKEN_DAYS = _int("REFRESH_TOKEN_DAYS", 14)
MFA_ISSUER = _env("MFA_ISSUER", "RAGENTIS")

# Optional separate key for encrypting stored secrets (MFA). When unset, a
# key is derived from JWT_SECRET_KEY (changing that secret then requires
# users to set up MFA again).
DATA_ENCRYPTION_KEY = os.getenv("DATA_ENCRYPTION_KEY", "")

LDAP_ENABLED = _bool("LDAP_ENABLED", False)
LDAP_SERVER_URL = os.getenv("LDAP_SERVER_URL", "")          # ldaps://dc01.corp.local:636
LDAP_BIND_TEMPLATE = _env("LDAP_BIND_TEMPLATE", "{username}")  # e.g. {username}@corp.local
LDAP_SEARCH_BASE = os.getenv("LDAP_SEARCH_BASE", "")        # dc=corp,dc=local
LDAP_USER_FILTER = _env("LDAP_USER_FILTER", "(sAMAccountName={username})")
LDAP_EMAIL_ATTRIBUTE = _env("LDAP_EMAIL_ATTRIBUTE", "mail")
# "CN=RAG-Admins,OU=Groups,DC=corp,DC=local=ADMIN;CN=RAG-Users,...=USER"
LDAP_GROUP_ROLE_MAP = os.getenv("LDAP_GROUP_ROLE_MAP", "")
LDAP_DEFAULT_ROLE = _env("LDAP_DEFAULT_ROLE", "VIEWER")
LDAP_TIMEOUT_SECONDS = _int("LDAP_TIMEOUT_SECONDS", 5)

# ------------------------------------------------------------------
# OCR, watched folder, reports
# ------------------------------------------------------------------

OCR_ENABLED = _bool("OCR_ENABLED", True)
OCR_LANGUAGES = _env("OCR_LANGUAGES", "eng")      # e.g. "eng+tam+hin" if installed
OCR_MAX_PAGES = _int("OCR_MAX_PAGES", 50)
OCR_DPI = _int("OCR_DPI", 200)

WATCH_FOLDER = os.getenv("WATCH_FOLDER", "")             # e.g. /app/watch
WATCH_INTERVAL_SECONDS = _int("WATCH_INTERVAL_SECONDS", 30)
WATCH_OWNER = os.getenv("WATCH_OWNER", "")               # username that owns auto-ingested files

REPORTS_DIR = Path(os.getenv("REPORTS_DIR", "reports"))


# ------------------------------------------------------------
# Search and models
# ------------------------------------------------------------
# Hybrid search: exact words / codes (invoice numbers, IDs) are matched in
# addition to meaning-based search.
HYBRID_SEARCH = os.getenv("HYBRID_SEARCH", "true").lower() == "true"
# Embedding model. For Tamil / Hindi / other languages use
# "paraphrase-multilingual-MiniLM-L12-v2" and re-index documents afterwards.
EMBEDDING_MODEL = _env("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
# Models an administrator may choose for their organisation (comma separated).
OLLAMA_ALLOWED_MODELS = [m.strip() for m in os.getenv("OLLAMA_ALLOWED_MODELS", "").split(",") if m.strip()]

# Retention clean-up runs this often (hours).
RETENTION_INTERVAL_HOURS = _int("RETENTION_INTERVAL_HOURS", 24)


# ------------------------------------------------------------
# Sign-in protection
# ------------------------------------------------------------
# Lock a local account for LOGIN_LOCK_MINUTES after LOGIN_LOCK_THRESHOLD
# wrong passwords or two-step codes in a row (Active Directory accounts
# follow the directory's own lockout policy).
LOGIN_LOCK_THRESHOLD = _int("LOGIN_LOCK_THRESHOLD", 5)
LOGIN_LOCK_MINUTES = _int("LOGIN_LOCK_MINUTES", 15)

# The refresh token lives in an HttpOnly cookie that JavaScript cannot read.
# "auto" marks it Secure when the request arrived over HTTPS.
REFRESH_COOKIE_NAME = "ragentis_session"
REFRESH_COOKIE_SECURE = _env("REFRESH_COOKIE_SECURE", "auto").lower()
# Two browser tabs may refresh at the same moment; a just-rotated token is
# accepted again for this many seconds instead of being treated as stolen.
REFRESH_REUSE_GRACE_SECONDS = _int("REFRESH_REUSE_GRACE_SECONDS", 30)
