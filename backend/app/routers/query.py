import json
import threading
import uuid

import anyio
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import QUERY_RATE_LIMIT
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.database.connection import SessionLocal, get_db
from app.dependencies.auth import get_user_group_ids
from app.dependencies.license import require_valid_license
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.ollama_service import LLMError
from app.services.prompt_builder import NOT_FOUND_ANSWER
from app.services.rag_service import RAGService, looks_like_not_found

router = APIRouter(prefix="/query", tags=["RAG Query"])
logger = get_logger("query")

rag_service = RAGService()

MAX_QUERY_CHARS = 2000


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)
    conversation_id: uuid.UUID | None = None


def _get_or_create_conversation(db: Session, user: User, conversation_id, query: str) -> Conversation:
    if conversation_id is not None:
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user.id,
                Conversation.tenant_id == user.tenant_id,
            )
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        return conversation

    conversation = Conversation(title=query[:60], user_id=user.id, tenant_id=user.tenant_id)
    db.add(conversation)
    db.flush()
    return conversation


def _history(db: Session, conversation: Conversation) -> list[dict]:
    rows = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(4)
    ).all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def _clean_query(query: str | None) -> str:
    query = (query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    if len(query) > MAX_QUERY_CHARS:
        raise HTTPException(status_code=400, detail=f"Questions are limited to {MAX_QUERY_CHARS} characters.")
    return query


# ------------------------------------------------------------
# Classic request / response (kept for compatibility)
# ------------------------------------------------------------

@router.post("/")
@limiter.limit(QUERY_RATE_LIMIT)
async def query_documents(
    request: Request,
    query: str | None = None,
    conversation_id: uuid.UUID | None = None,
    body: QueryRequest | None = Body(None),
    current_user: User = Depends(require_valid_license),
    db: Session = Depends(get_db),
):
    """
    Ask a question. Send JSON {"query": ..., "conversation_id": ...}
    (preferred: the question is not written to URL logs) or use the old
    ?query= parameter.
    """
    if body is not None:
        query, conversation_id = body.query, body.conversation_id
    query = _clean_query(query)

    conversation = _get_or_create_conversation(db, current_user, conversation_id, query)
    history = _history(db, conversation)
    tenant = current_user.tenant
    group_ids = get_user_group_ids(db, current_user)

    try:
        result = await run_in_threadpool(
            rag_service.generate_answer,
            query,
            str(current_user.id),
            str(current_user.tenant_id),
            tenant.retrieval_depth,
            group_ids,
            history,
        )
    except LLMError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc))

    sources = result["sources"] if tenant.source_attribution else []

    db.add(Message(conversation_id=conversation.id, role="user", content=query))
    assistant = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result["answer"],
        sources=sources,
        answer_status=result["status"],
    )
    db.add(assistant)
    conversation.updated_at = datetime.utcnow()
    db.commit()

    return {
        "conversation_id": str(conversation.id),
        "message_id": str(assistant.id),
        "query": query,
        "answer": result["answer"],
        "status": result["status"],
        "sources": sources,
        "user_id": str(current_user.id),
        "tenant_id": str(current_user.tenant_id),
    }


# ------------------------------------------------------------
# Streaming (Server-Sent Events)
# ------------------------------------------------------------

def _close_when_idle(generator, timeout: float = 30.0) -> None:
    """Close the token generator (releases the LLM slot and the HTTP stream).
    If a worker thread is still inside next(), wait for it to return."""
    import time

    end = time.time() + timeout
    while True:
        try:
            generator.close()
            return
        except ValueError:  # generator already executing
            if time.time() > end:
                return
            time.sleep(0.05)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
@limiter.limit(QUERY_RATE_LIMIT)
def query_stream(
    request: Request,
    payload: QueryRequest,
    current_user: User = Depends(require_valid_license),
    db: Session = Depends(get_db),
):
    """
    Events: meta -> token* -> sources -> done   (or error).
    Closing the connection stops generation; the partial answer is saved
    with status "stopped".
    """

    query = _clean_query(payload.query)
    conversation = _get_or_create_conversation(db, current_user, payload.conversation_id, query)
    history = _history(db, conversation)
    db.add(Message(conversation_id=conversation.id, role="user", content=query))
    conversation.updated_at = datetime.utcnow()
    db.commit()

    conversation_id = conversation.id
    user_id, tenant_id = str(current_user.id), str(current_user.tenant_id)
    top_k = current_user.tenant.retrieval_depth
    show_sources = current_user.tenant.source_attribution
    group_ids = get_user_group_ids(db, current_user)

    def save(answer: str, status: str, sources: list) -> str:
        session = SessionLocal()
        try:
            message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=answer or "(no answer)",
                sources=sources,
                answer_status=status,
            )
            session.add(message)
            session.commit()
            return str(message.id)
        finally:
            session.close()

    async def events():
        yield _sse("meta", {"conversation_id": str(conversation_id)})

        try:
            prepared = await run_in_threadpool(rag_service.prepare, query, user_id, tenant_id, top_k, group_ids, history)
        except Exception:
            logger.exception("Retrieval failed")
            await run_in_threadpool(save, "Retrieval failed.", "error", [])
            yield _sse("error", {"detail": "Searching your documents failed. Try again."})
            return

        if not prepared.found:
            message_id = await run_in_threadpool(save, NOT_FOUND_ANSWER, "not_found", [])
            yield _sse("token", {"text": NOT_FOUND_ANSWER})
            yield _sse("sources", {"sources": []})
            yield _sse("done", {"message_id": message_id, "status": "not_found"})
            return

        parts: list[str] = []
        stop = threading.Event()
        tokens = rag_service.stream(prepared, stop=stop)
        end = object()
        stopped = False
        try:
            while True:
                if await request.is_disconnected():
                    stopped = True
                    break
                piece = await run_in_threadpool(next, tokens, end)
                if piece is end:
                    break
                parts.append(piece)
                yield _sse("token", {"text": piece})
        except LLMError as exc:
            await run_in_threadpool(save, "".join(parts) or str(exc), "error", [])
            yield _sse("error", {"detail": str(exc)})
            return
        except BaseException:
            # Cancelled because the client went away.
            stopped = True
            raise
        finally:
            if stopped:
                # The worker thread sees the flag, closes the HTTP stream to
                # Ollama (which stops generating) and the partial answer is kept.
                stop.set()
                with anyio.CancelScope(shield=True):
                    await run_in_threadpool(_close_when_idle, tokens)
                    await run_in_threadpool(
                        save, "".join(parts) or "(stopped)", "stopped", prepared.sources if show_sources else []
                    )

        if stopped:
            return

        answer = "".join(parts).strip()
        status = "not_found" if looks_like_not_found(answer) else "answered"
        sources = prepared.sources if (show_sources and status == "answered") else []
        message_id = await run_in_threadpool(save, answer, status, sources)
        yield _sse("sources", {"sources": sources})
        yield _sse("done", {"message_id": message_id, "status": status})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
