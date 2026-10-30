import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.conversation import Conversation
from app.models.user import User
from app.models.message import Message
from app.schemas.conversation import (
    ConversationCreate,
    FeedbackRequest,
    ConversationDetailResponse,
    ConversationResponse,
)

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


@router.post(
    "/",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = Conversation(
        title=data.title.strip() or "New Chat",
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get(
    "/",
    response_model=list[ConversationResponse],
)
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = db.scalars(
        select(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.tenant_id == current_user.tenant_id,
        )
        .order_by(Conversation.updated_at.desc())
    ).all()

    return conversations


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
)
def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
            Conversation.tenant_id == current_user.tenant_id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return conversation


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
            Conversation.tenant_id == current_user.tenant_id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    db.delete(conversation)
    db.commit()

    return None


@router.post("/messages/{message_id}/feedback")
def message_feedback(
    message_id: uuid.UUID,
    payload: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Thumbs up / down on an answer, only by the conversation owner."""

    message = db.scalar(
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Message.id == message_id,
            Message.role == "assistant",
            Conversation.user_id == current_user.id,
            Conversation.tenant_id == current_user.tenant_id,
        )
    )
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")

    message.feedback_rating = payload.rating
    message.feedback_reason = (payload.reason or "").strip() or None
    db.commit()
    return {"message_id": str(message.id), "rating": message.feedback_rating}
