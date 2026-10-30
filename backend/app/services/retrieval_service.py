"""
Retrieval for the RAG pipeline.

1. If the question names one of the user's accessible documents (by filename
   words), search only that document with a relaxed threshold (0.85).
2. Otherwise search all accessible documents (private + tenant shared +
   the user's team spaces) with the normal threshold (0.75).
3. Drop chunks whose cosine distance is above the threshold.
4. Remove duplicate chunks and keep the best top_k.
"""

from __future__ import annotations

import re

from app.core.logging import get_logger
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore

logger = get_logger("retrieval")

EMPTY = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}


class RetrievalService:

    NORMAL_THRESHOLD = 0.75
    DOCUMENT_THRESHOLD = 0.85
    CANDIDATE_MULTIPLIER = 3

    STOP_WORDS = {
        "what", "which", "who", "where", "when", "why", "how", "is", "are", "was", "were",
        "the", "a", "an", "and", "or", "of", "in", "on", "to", "from", "for", "does", "do",
        "did", "tell", "me", "about", "show", "give", "please", "my", "your", "their", "this",
        "that", "these", "those", "can", "could", "would", "should", "be", "it", "its",
    }

    IMPORTANT_DOCUMENT_WORDS = {
        "resume", "cv", "report", "handout", "notes", "assignment", "project",
        "document", "thesis", "paper", "agreement", "policy", "invoice", "contract",
    }

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    def _normalize_tokens(self, text: str) -> set[str]:
        if not text:
            return set()
        text = re.sub(r"\.(pdf|docx|xlsx|csv)\b", " ", text.lower())
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return {t for t in text.split() if t not in self.STOP_WORDS and len(t) > 2}

    def _find_document_match(self, query: str, documents: list[dict]):
        query_tokens = self._normalize_tokens(query)
        if not query_tokens:
            return None

        best_document, best_score = None, 0
        for document in documents:
            overlap = query_tokens & self._normalize_tokens(document.get("filename", ""))
            if not overlap:
                continue
            score = len(overlap) + 2 * len(overlap & self.IMPORTANT_DOCUMENT_WORDS)
            if score > best_score:
                best_score, best_document = score, document
        return best_document

    @staticmethod
    def _deduplicate(items: list[dict], top_k: int) -> list[dict]:
        seen_doc, seen_name, selected = set(), set(), []
        for item in items:
            metadata = item["metadata"] or {}
            chunk_index = metadata.get("chunk_index")
            doc_key = (metadata.get("document_id", ""), chunk_index)
            name_key = (str(metadata.get("filename", "")).lower().strip(), chunk_index)
            if doc_key in seen_doc or name_key in seen_name:
                continue
            seen_doc.add(doc_key)
            seen_name.add(name_key)
            selected.append(item)
            if len(selected) >= top_k:
                break
        return selected

    def retrieve(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        top_k: int = 5,
        group_ids: list[str] | None = None,
        document_id: str | None = None,
    ):
        if not query or not query.strip():
            raise ValueError("Query cannot be empty.")
        if not user_id or not tenant_id:
            raise ValueError("User and tenant are required.")
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")

        query_embedding = self.embedding_service.generate_embedding(query)

        matched = None
        if document_id is None:
            accessible = self.vector_store.get_user_documents(user_id, tenant_id, group_ids)
            matched = self._find_document_match(query, accessible)
            if matched:
                document_id = matched["document_id"]

        threshold = self.DOCUMENT_THRESHOLD if document_id else self.NORMAL_THRESHOLD
        candidate_count = max(top_k * self.CANDIDATE_MULTIPLIER, 15)

        results = self.vector_store.search(
            query_embedding=query_embedding,
            user_id=user_id,
            tenant_id=tenant_id,
            top_k=candidate_count,
            document_id=document_id,
            group_ids=group_ids,
        )

        distances = results.get("distances", [[]])[0]
        if not distances:
            return dict(EMPTY)

        items = [
            {
                "id": results["ids"][0][i],
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": distance,
            }
            for i, distance in enumerate(distances)
            if distance <= threshold
        ]
        items.sort(key=lambda item: item["distance"])
        final = self._deduplicate(items, top_k)

        logger.debug(
            "Retrieval finished",
            extra={"fields": {
                "candidates": len(distances),
                "kept": len(final),
                "threshold": threshold,
                "document_scoped": bool(document_id),
            }},
        )

        return {
            "ids": [[i["id"] for i in final]],
            "documents": [[i["document"] for i in final]],
            "metadatas": [[i["metadata"] for i in final]],
            "distances": [[i["distance"] for i in final]],
        }
