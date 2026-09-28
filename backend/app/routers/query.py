import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.license import require_valid_license
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.rag_service import RAGService


router = APIRouter(
    prefix="/query",
    tags=["RAG Query"],
)


rag_service = RAGService()


@router.post("/")
def query_documents(
    query: str,
    conversation_id: uuid.UUID | None = None,
    current_user: User = Depends(require_valid_license),
    db: Session = Depends(get_db),
):
    """
    Query the authenticated user's tenant documents.

    If a conversation_id is provided, the query and generated answer
    are saved as messages in that conversation.

    If no conversation_id is provided, a new conversation is created.

    Access requires a valid tenant license.

    RAG settings such as retrieval depth and source attribution
    are taken from the authenticated user's tenant configuration.

    The user_id and tenant_id are always taken from the
    authenticated user.
    """

    # ------------------------------------------------------------
    # Validate query
    # ------------------------------------------------------------

    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty.",
        )

    query = query.strip()

    # ------------------------------------------------------------
    # Get existing conversation OR create a new one
    # ------------------------------------------------------------

    if conversation_id is not None:

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
                detail="Conversation not found.",
            )

    else:

        # Use the first user message as the conversation title.
        title = query[:60]

        conversation = Conversation(
            title=title,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
        )

        db.add(conversation)
        db.flush()

        conversation_id = conversation.id

    # ------------------------------------------------------------
    # Save USER message
    # ------------------------------------------------------------

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=query,
    )

    db.add(user_message)

    # ------------------------------------------------------------
    # Get tenant RAG settings
    # ------------------------------------------------------------

    tenant = current_user.tenant

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    # ------------------------------------------------------------
    # Run RAG
    # ------------------------------------------------------------
    result = rag_service.generate_answer(
    query=query,
    user_id=str(current_user.id),
    tenant_id=str(current_user.tenant_id),
    top_k=tenant.retrieval_depth,
)
    

    answer = result["answer"]

    # ------------------------------------------------------------
    # Save ASSISTANT message
    # ------------------------------------------------------------

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
    )

    db.add(assistant_message)

    # ------------------------------------------------------------
    # Update conversation timestamp
    # ------------------------------------------------------------

    conversation.updated_at = (
        __import__("datetime").datetime.utcnow()
    )

    # ------------------------------------------------------------
    # Commit conversation + messages
    # ------------------------------------------------------------

    db.commit()

    # ------------------------------------------------------------
    # Source attribution
    # ------------------------------------------------------------

    sources = (
        result["sources"]
        if tenant.source_attribution
        else []
    )

    # ------------------------------------------------------------
    # Return response
    # ------------------------------------------------------------

    return {
        "conversation_id": str(conversation.id),
        "query": query,
        "answer": answer,
        "sources": sources,
        "user_id": str(current_user.id),
        "tenant_id": str(current_user.tenant_id),
    }

