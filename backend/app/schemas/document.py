from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    processed: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )