"""
ChromaDB access with per-user and per-tenant isolation.

Collections:
    user_<user_id>            PRIVATE chunks of one user
    tenant_shared_<tenant_id> TENANT chunks (whole tenant) and GROUP chunks
                              (team spaces, filtered by group_id)

Every query also filters on tenant_id / user_id / visibility metadata, so
isolation does not depend on collection names alone.
"""

from __future__ import annotations

from functools import lru_cache

import chromadb

from app.core.config import CHROMA_PATH
from app.core.logging import get_logger

logger = get_logger("vector_store")

VISIBILITIES = {"PRIVATE", "TENANT", "GROUP"}


def _cosine_distance(a, b) -> float:
    if a is None or b is None:
        return 1.0
    dot = sum(float(x) * float(y) for x, y in zip(a, b))
    norm_a = sum(float(x) * float(x) for x in a) ** 0.5
    norm_b = sum(float(y) * float(y) for y in b) ** 0.5
    if not norm_a or not norm_b:
        return 1.0
    return max(0.0, 1.0 - dot / (norm_a * norm_b))


@lru_cache(maxsize=1)
def _client():
    # One client per process, as recommended by Chroma.
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


class VectorStore:

    def __init__(self):
        self.client = _client()

    # ------------------------------------------------------------
    # Collections
    # ------------------------------------------------------------

    def _get_user_collection(self, user_id: str):
        if not user_id:
            raise ValueError("User ID is required.")
        return self.client.get_or_create_collection(
            name=f"user_{user_id}", metadata={"hnsw:space": "cosine"}
        )

    def _get_shared_collection(self, tenant_id: str):
        if not tenant_id:
            raise ValueError("Tenant ID is required.")
        return self.client.get_or_create_collection(
            name=f"tenant_shared_{tenant_id}", metadata={"hnsw:space": "cosine"}
        )

    def _collection_for(self, visibility: str, user_id: str, tenant_id: str):
        if visibility == "PRIVATE":
            return self._get_user_collection(user_id)
        return self._get_shared_collection(tenant_id)

    @staticmethod
    def _shared_filter(tenant_id: str, group_ids: list[str] | None, document_id: str | None):
        scope = [{"visibility": "TENANT"}]
        if group_ids:
            scope.append({"$and": [{"visibility": "GROUP"}, {"group_id": {"$in": list(group_ids)}}]})
        conditions = [{"tenant_id": tenant_id}, scope[0] if len(scope) == 1 else {"$or": scope}]
        if document_id:
            conditions.append({"document_id": document_id})
        return {"$and": conditions}

    @staticmethod
    def _private_filter(tenant_id: str, user_id: str, document_id: str | None):
        conditions = [{"tenant_id": tenant_id}, {"user_id": user_id}, {"visibility": "PRIVATE"}]
        if document_id:
            conditions.append({"document_id": document_id})
        return {"$and": conditions}

    # ------------------------------------------------------------
    # Write
    # ------------------------------------------------------------

    def add_chunks(
        self,
        chunks,
        embeddings,
        document_id,
        user_id,
        tenant_id,
        filename,
        visibility,
        group_id: str | None = None,
        locations: list[dict] | None = None,
    ):
        if not chunks:
            raise ValueError("Chunks cannot be empty.")
        if not embeddings or len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings count must match.")
        if visibility not in VISIBILITIES:
            raise ValueError("Invalid visibility.")
        if visibility == "GROUP" and not group_id:
            raise ValueError("GROUP documents need a group.")

        collection = self._collection_for(visibility, user_id, tenant_id)

        metadatas = []
        for index in range(len(chunks)):
            metadata = {
                "document_id": document_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "filename": filename,
                "chunk_index": index,
                "visibility": visibility,
                "group_id": group_id or "",
            }
            location = (locations or [{}] * len(chunks))[index] or {}
            if location.get("page") is not None:
                metadata["page"] = int(location["page"])
            if location.get("sheet"):
                metadata["sheet"] = str(location["sheet"])[:100]
            metadatas.append(metadata)

        # Insert in batches to keep memory low on large documents.
        batch = 256
        for start in range(0, len(chunks), batch):
            end = start + batch
            collection.add(
                ids=[f"{document_id}_{i}" for i in range(start, min(end, len(chunks)))],
                documents=chunks[start:end],
                embeddings=embeddings[start:end],
                metadatas=metadatas[start:end],
            )

        return len(chunks)

    # ------------------------------------------------------------
    # Search
    # ------------------------------------------------------------

    def search(
        self,
        query_embedding,
        user_id,
        tenant_id,
        top_k=5,
        document_id=None,
        group_ids: list[str] | None = None,
    ):
        if not user_id:
            raise ValueError("User ID is required.")
        if not tenant_id:
            raise ValueError("Tenant ID is required.")

        merged = []

        for collection, where in (
            (self._get_user_collection(user_id), self._private_filter(tenant_id, user_id, document_id)),
            (self._get_shared_collection(tenant_id), self._shared_filter(tenant_id, group_ids, document_id)),
        ):
            count = collection.count()
            if count == 0:
                continue
            result = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, count),
                where=where,
            )
            ids = result.get("ids", [[]])[0]
            documents = result.get("documents", [[]])[0]
            metadatas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]
            for i in range(len(ids)):
                merged.append(
                    {"id": ids[i], "document": documents[i], "metadata": metadatas[i], "distance": distances[i]}
                )

        merged.sort(key=lambda item: item["distance"])
        merged = merged[:top_k]

        return {
            "ids": [[m["id"] for m in merged]],
            "documents": [[m["document"] for m in merged]],
            "metadatas": [[m["metadata"] for m in merged]],
            "distances": [[m["distance"] for m in merged]],
        }

    def keyword_search(
        self,
        terms: list[str],
        query_embedding,
        user_id,
        tenant_id,
        limit: int = 20,
        document_id=None,
        group_ids: list[str] | None = None,
    ) -> list[dict]:
        """
        Chunks that contain any of `terms` literally (same access filters as
        search). Each hit carries its cosine distance to the question and
        how many terms it contains.
        """
        if not terms:
            return []
        if len(terms) == 1:
            where_document = {"$contains": terms[0]}
        else:
            where_document = {"$or": [{"$contains": t} for t in terms]}

        hits = []
        for collection, where in (
            (self._get_user_collection(user_id), self._private_filter(tenant_id, user_id, document_id)),
            (self._get_shared_collection(tenant_id), self._shared_filter(tenant_id, group_ids, document_id)),
        ):
            if collection.count() == 0:
                continue
            result = collection.get(
                where=where,
                where_document=where_document,
                limit=limit,
                include=["documents", "metadatas", "embeddings"],
            )
            embeddings = result.get("embeddings")
            for i, chunk_id in enumerate(result.get("ids") or []):
                text = result["documents"][i] or ""
                vector = embeddings[i] if embeddings is not None and len(embeddings) > i else None
                hits.append({
                    "id": chunk_id,
                    "document": text,
                    "metadata": result["metadatas"][i],
                    "distance": _cosine_distance(query_embedding, vector),
                    "matches": sum(1 for t in terms if t in text),
                })
        hits.sort(key=lambda h: (-h["matches"], h["distance"]))
        return hits[:limit]

    # ------------------------------------------------------------
    # Accessible documents (metadata only)
    # ------------------------------------------------------------

    def get_user_documents(self, user_id: str, tenant_id: str, group_ids: list[str] | None = None):
        documents = {}
        for collection, where in (
            (self._get_user_collection(user_id), self._private_filter(tenant_id, user_id, None)),
            (self._get_shared_collection(tenant_id), self._shared_filter(tenant_id, group_ids, None)),
        ):
            if collection.count() == 0:
                continue
            result = collection.get(where=where, include=["metadatas"])
            for metadata in result.get("metadatas") or []:
                if metadata and metadata.get("document_id"):
                    documents[metadata["document_id"]] = metadata
        return list(documents.values())

    def get_document_chunks(self, document_id: str, user_id: str, tenant_id: str, visibility: str) -> list[str]:
        collection = self._collection_for(visibility, user_id, tenant_id)
        if collection.count() == 0:
            return []
        result = collection.get(
            where={"$and": [{"document_id": document_id}, {"tenant_id": tenant_id}]},
            include=["documents", "metadatas"],
        )
        pairs = sorted(
            zip(result.get("metadatas") or [], result.get("documents") or []),
            key=lambda pair: (pair[0] or {}).get("chunk_index", 0),
        )
        return [text for _, text in pairs]

    # ------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------

    def delete_document_vectors(self, document_id: str, user_id: str, tenant_id: str, visibility: str):
        collection = self._collection_for(visibility, user_id, tenant_id)
        if collection.count() == 0:
            return
        collection.delete(where={"$and": [{"document_id": document_id}, {"tenant_id": tenant_id}]})
        logger.info("Vectors deleted", extra={"fields": {"document_id": document_id, "visibility": visibility}})
