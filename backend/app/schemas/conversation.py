import uuid
from datetime import datetime


from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str = Field("New Chat", max_length=255)


class FeedbackRequest(BaseModel):
    rating: Literal["up", "down"]
    reason: str | None = Field(None, max_length=500)


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: list | None = None
    answer_status: str | None = None
    feedback_rating: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]

    model_config = ConfigDict(from_attributes=True)

    