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

# ------------------------------------------------------------------
# Sessions, MFA, directory login
# ------------------------------------------------------------------

REFRESH_TOKEN_DAYS = _int("REFRESH_TOKEN_DAYS", 14)
MFA_ISSUER = os.getenv("MFA_ISSUER", "RAGENTIS")

# Optional separate key for encrypting stored secrets (MFA). When unset, a
# key is derived from JWT_SECRET_KEY (changing that secret then requires
# users to set up MFA again).
DATA_ENCRYPTION_KEY = os.getenv("DATA_ENCRYPTION_KEY", "")

LDAP_ENABLED = _bool("LDAP_ENABLED", False)
LDAP_SERVER_URL = os.getenv("LDAP_SERVER_URL", "")          # ldaps://dc01.corp.local:636
LDAP_BIND_TEMPLATE = os.getenv("LDAP_BIND_TEMPLATE", "{username}")  # e.g. {username}@corp.local
LDAP_SEARCH_BASE = os.getenv("LDAP_SEARCH_BASE", "")        # dc=corp,dc=local
LDAP_USER_FILTER = os.getenv("LDAP_USER_FILTER", "(sAMAccountName={username})")
LDAP_EMAIL_ATTRIBUTE = os.getenv("LDAP_EMAIL_ATTRIBUTE", "mail")
# "CN=RAG-Admins,OU=Groups,DC=corp,DC=local=ADMIN;CN=RAG-Users,...=USER"
LDAP_GROUP_ROLE_MAP = os.getenv("LDAP_GROUP_ROLE_MAP", "")
LDAP_DEFAULT_ROLE = os.getenv("LDAP_DEFAULT_ROLE", "VIEWER")
LDAP_TIMEOUT_SECONDS = _int("LDAP_TIMEOUT_SECONDS", 5)
