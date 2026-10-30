"""
Document ingestion: extract -> (PII check) -> chunk -> embed -> index.

Runs in a small background worker pool (INGESTION_CONCURRENCY, default 1),
so uploads return immediately and the chat keeps working while a large file
is processed. Status moves queued -> processing -> ready | failed.
"""

from __future__ import annotations

import threading
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import INGESTION_CONCURRENCY
from app.core.logging import get_logger
from app.database.connection import SessionLocal
from app.models.document import Document
from app.models.tenant import Tenant
from app.services import audit_service, pii_service
from app.services.document_processor import ExtractionError, extract_segments
from app.services.embedding_service import EmbeddingService
from app.services.text_splitter import split_text
from app.services.vector_store import VectorStore

logger = get_logger("ingestion")

_executor = ThreadPoolExecutor(max_workers=max(1, INGESTION_CONCURRENCY), thread_name_prefix="ingest")
_pending: set[str] = set()
_pending_lock = threading.Lock()


class DocumentIngestionService:

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    def index(
        self,
        file_path: str,
        file_type: str,
        document_id: str,
        user_id: str,
        tenant_id: str,
        filename: str,
        visibility: str,
        group_id: str | None = None,
        pii_mode: str = "flag",
    ) -> dict:
        segments = extract_segments(file_path, file_type)

        chunks: list[str] = []
        locations: list[dict] = []
        pii_counts: Counter = Counter()

        for segment in segments:
            text = segment.text
            if pii_mode == "redact":
                text, found = pii_service.redact(text)
                pii_counts.update(found)
            elif pii_mode == "flag":
                pii_counts.update(pii_service.scan(text))

            if not text.strip():
                continue
            for chunk in split_text(text):
                chunks.append(chunk)
                locations.append({"page": segment.page, "sheet": segment.sheet})

        if not chunks:
            raise ExtractionError("No text could be extracted from the document.")

        embeddings = self.embedding_service.generate_embeddings(chunks)

        stored = self.vector_store.add_chunks(
            chunks=chunks,
            embeddings=embeddings,
            document_id=document_id,
            user_id=user_id,
            tenant_id=tenant_id,
            filename=filename,
            visibility=visibility,
            group_id=group_id,
            locations=locations,
        )

        pages = [s.page for s in segments if s.page is not None]
        return {
            "chunks": stored,
            "page_count": max(pages) if pages else None,
            "pii": dict(pii_counts),
        }

    # Backwards-compatible name used by older scripts.
    def process_document(self, file_path, file_type, document_id, user_id, tenant_id, filename, visibility):
        result = self.index(file_path, file_type, document_id, user_id, tenant_id, filename, visibility)
        return {"document_id": document_id, "filename": filename, "tenant_id": tenant_id,
                "user_id": user_id, "visibility": visibility, "chunks": result["chunks"]}


def _process(document_id: str) -> None:
    db = SessionLocal()
    try:
        document = db.get(Document, uuid.UUID(document_id))
        if document is None:
            return
        tenant = db.get(Tenant, document.tenant_id)
        pii_mode = (tenant.pii_mode if tenant else "flag") or "flag"

        document.status = "processing"
        document.error_message = None
        db.commit()

        # Remove vectors from an earlier failed attempt before re-indexing.
        service = DocumentIngestionService()
        service.vector_store.delete_document_vectors(
            document_id=document_id,
            user_id=str(document.user_id),
            tenant_id=str(document.tenant_id),
            visibility=document.visibility,
        )

        result = service.index(
            file_path=document.file_path,
            file_type=document.file_type,
            document_id=document_id,
            user_id=str(document.user_id),
            tenant_id=str(document.tenant_id),
            filename=document.filename,
            visibility=document.visibility,
            group_id=str(document.group_id) if document.group_id else None,
            pii_mode=pii_mode,
        )

        document.status = "ready"
        document.processed = True
        document.chunk_count = result["chunks"]
        document.page_count = result["page_count"]
        document.pii_summary = (
            {"mode": pii_mode, "counts": result["pii"], "total": sum(result["pii"].values())}
            if pii_mode != "off" else None
        )
        document.processed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Document indexed", extra={"fields": {"document_id": document_id, "chunks": result["chunks"]}})

    except ExtractionError as exc:
        _fail(db, document_id, str(exc))
    except Exception:
        logger.exception("Ingestion failed", extra={"fields": {"document_id": document_id}})
        _fail(db, document_id, "Processing failed because of an internal error. Try again or contact the administrator.")
    finally:
        db.close()
        with _pending_lock:
            _pending.discard(document_id)


def _fail(db, document_id: str, message: str) -> None:
    db.rollback()
    document = db.get(Document, uuid.UUID(document_id))
    if document is None:
        return
    document.status = "failed"
    document.processed = False
    document.error_message = message
    db.commit()
    audit_service.record(
        "document.processing_failed",
        tenant_id=document.tenant_id,
        outcome="failure",
        target_type="document",
        target_id=document.id,
        target_label=document.filename,
        details={"reason": message},
    )


def enqueue(document_id) -> None:
    key = str(document_id)
    with _pending_lock:
        if key in _pending:
            return
        _pending.add(key)
    _executor.submit(_process, key)


def queue_length() -> int:
    with _pending_lock:
        return len(_pending)


def resume_unfinished() -> int:
    """At startup, re-queue documents that were waiting or interrupted."""
    db = SessionLocal()
    try:
        ids = db.scalars(
            select(Document.id).where(Document.status.in_(["queued", "processing"]))
        ).all()
    finally:
        db.close()
    for document_id in ids:
        enqueue(document_id)
    return len(ids)


def wait_idle(timeout: float = 60.0) -> bool:
    """Testing helper: wait until the queue is empty."""
    import time

    end = time.time() + timeout
    while time.time() < end:
        if queue_length() == 0:
            return True
        time.sleep(0.1)
    return False
