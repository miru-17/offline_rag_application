from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    processed: bool
    status: str = "ready"
    error_message: str | None = None
    visibility: str = "PRIVATE"
    group_id: UUID | None = None
    group_name: str | None = None
    chunk_count: int = 0
    page_count: int | None = None
    file_size: int | None = None
    pii_summary: dict | None = None
    owner: str | None = None
    created_at: datetime
    processed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CompareRequest(BaseModel):
    document_a: UUID
    document_b: UUID
    summarize: bool = False
