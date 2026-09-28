from pydantic import BaseModel, Field


class RAGSettingsResponse(BaseModel):
    retrieval_depth: int
    source_attribution: bool


class RAGSettingsUpdate(BaseModel):
    retrieval_depth: int = Field(
        ge=3,
        le=10,
    )

    source_attribution: bool