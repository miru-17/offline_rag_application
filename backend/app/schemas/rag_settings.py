from typing import Literal

from pydantic import BaseModel, Field

from app.services.prompt_builder import LANGUAGES

LanguageCode = Literal.__getitem__(("auto", *LANGUAGES.keys()))  # type: ignore[valid-type]


class RAGSettingsResponse(BaseModel):
    retrieval_depth: int
    source_attribution: bool
    pii_mode: str = "flag"
    hybrid_search: bool = True
    answer_language: str = "auto"
    llm_model: str
    conversation_retention_days: int | None = None
    audit_retention_days: int | None = None
    document_retention_days: int | None = None


class RAGSettingsUpdate(BaseModel):
    """Fields left out are not changed. A retention value of null means keep forever."""

    retrieval_depth: int | None = Field(None, ge=3, le=10)
    source_attribution: bool | None = None
    pii_mode: Literal["off", "flag", "redact"] | None = None
    hybrid_search: bool | None = None
    answer_language: LanguageCode | None = None
    llm_model: str | None = Field(None, max_length=100)
    conversation_retention_days: int | None = Field(None, ge=1, le=3650)
    audit_retention_days: int | None = Field(None, ge=30, le=3650)
    document_retention_days: int | None = Field(None, ge=30, le=3650)
