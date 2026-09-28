import re

from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore


class RetrievalService:
    """
    Handles document retrieval for the RAG pipeline.

    Retrieval strategy:

    1. Identify whether the user is referring to a
       specific accessible document.
    2. If a document is identified, search only inside
       that document.
    3. Otherwise, perform semantic retrieval across
       all documents accessible to the current user:
          - User's PRIVATE documents
          - Tenant's TENANT/shared documents
    4. Apply similarity filtering.
    5. Remove duplicate chunks.
    """

    # Chroma cosine distance:
    # lower distance = better match.

    NORMAL_THRESHOLD = 0.75

    DOCUMENT_THRESHOLD = 0.85

    CANDIDATE_MULTIPLIER = 3

    STOP_WORDS = {
        "what",
        "which",
        "who",
        "where",
        "when",
        "why",
        "how",
        "is",
        "are",
        "was",
        "were",
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "in",
        "on",
        "to",
        "from",
        "for",
        "does",
        "do",
        "did",
        "tell",
        "me",
        "about",
        "show",
        "give",
        "please",
        "my",
        "your",
        "their",
        "this",
        "that",
        "these",
        "those",
        "can",
        "could",
        "would",
        "should",
        "be",
        "it",
        "its",
    }

    IMPORTANT_DOCUMENT_WORDS = {
        "resume",
        "cv",
        "report",
        "handout",
        "notes",
        "assignment",
        "project",
        "document",
        "thesis",
        "paper",
        "agreement",
    }

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    # ---------------------------------------------------------
    # TEXT NORMALIZATION
    # ---------------------------------------------------------

    def _normalize_tokens(
        self,
        text: str,
    ) -> set[str]:

        if not text:
            return set()

        text = text.lower()

        text = re.sub(
            r"\.(pdf|docx|xlsx)\b",
            " ",
            text,
        )

        text = re.sub(
            r"[^a-z0-9]+",
            " ",
            text,
        )

        tokens = set()

        for token in text.split():

            if not token:
                continue

            if token in self.STOP_WORDS:
                continue

            if len(token) <= 2:
                continue

            tokens.add(token)

        return tokens

    # ---------------------------------------------------------
    # DOCUMENT MATCHING
    # ---------------------------------------------------------

    def _find_document_match(
        self,
        query: str,
        documents: list[dict],
    ):
        """
        Detect whether the query refers to a particular
        accessible uploaded document based on filename tokens.

        Documents passed here already represent the user's
        authorized scope:

            1. User's PRIVATE documents
            2. Tenant's TENANT/shared documents
        """

        query_tokens = self._normalize_tokens(query)

        print("\n=== DOCUMENT MATCHING DEBUG ===")
        print(f"Query          : {query}")
        print(f"Query tokens   : {sorted(query_tokens)}")

        if not query_tokens:
            print("No query tokens — skipping document match.")
            print("================================\n")
            return None

        best_document = None
        best_score = 0

        for document in documents:

            filename = document.get(
                "filename",
                "",
            )

            filename_tokens = self._normalize_tokens(
                filename
            )

            if not filename_tokens:
                continue

            overlap = query_tokens.intersection(
                filename_tokens
            )

            if not overlap:
                continue

            score = len(overlap)

            important_overlap = overlap.intersection(
                self.IMPORTANT_DOCUMENT_WORDS
            )

            score += len(important_overlap) * 2

            print(
                f"\n  [CANDIDATE] {filename}"
            )

            print(
                f"  filename tokens: {sorted(filename_tokens)}"
            )

            print(
                f"  overlap        : {sorted(overlap)}"
            )

            print(
                f"  score          : {score}"
            )

            if score > best_score:
                best_score = score
                best_document = document

        if best_document:
            print(
                f"\n  => MATCHED: "
                f"{best_document.get('filename')} "
                f"(score={best_score})"
            )
        else:
            print(
                "\n  => NO MATCH: "
                "no filename tokens overlap with query."
            )

        print("================================\n")

        return best_document

    # ---------------------------------------------------------
    # RESULT DEDUPLICATION
    # ---------------------------------------------------------

    def _deduplicate_results(
        self,
        ids,
        documents,
        metadatas,
        distances,
        top_k,
    ):
        """
        Removes duplicate chunks.

        Duplicate protection uses:

            document_id + chunk_index

        and additionally:

            filename + chunk_index
        """

        seen_document_chunks = set()
        seen_filename_chunks = set()

        selected = []

        for index, distance in enumerate(
            distances
        ):

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                else {}
            )

            document_id = metadata.get(
                "document_id",
                "",
            )

            filename = metadata.get(
                "filename",
                "",
            )

            chunk_index = metadata.get(
                "chunk_index",
                index,
            )

            document_key = (
                document_id,
                chunk_index,
            )

            filename_key = (
                filename.lower().strip(),
                chunk_index,
            )

            if document_key in seen_document_chunks:
                print(
                    f"  [DEDUP] Skipping duplicate "
                    f"document_id={document_id}, "
                    f"chunk={chunk_index}"
                )
                continue

            if filename_key in seen_filename_chunks:
                print(
                    f"  [DEDUP] Skipping duplicate "
                    f"filename={filename}, "
                    f"chunk={chunk_index}"
                )
                continue

            seen_document_chunks.add(
                document_key
            )

            seen_filename_chunks.add(
                filename_key
            )

            selected.append(index)

            if len(selected) >= top_k:
                break

        return {
            "ids": [
                [
                    ids[index]
                    for index in selected
                ]
            ],
            "documents": [
                [
                    documents[index]
                    for index in selected
                ]
            ],
            "metadatas": [
                [
                    metadatas[index]
                    for index in selected
                ]
            ],
            "distances": [
                [
                    distances[index]
                    for index in selected
                ]
            ],
        }

    # ---------------------------------------------------------
    # MAIN RETRIEVAL
    # ---------------------------------------------------------

    def retrieve(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        top_k: int = 5,
    ):
        if not query or not query.strip():
            raise ValueError(
                "Query cannot be empty."
            )

        if not user_id:
            raise ValueError(
                "User ID is required."
            )

        if not tenant_id:
            raise ValueError(
                "Tenant ID is required."
            )

        if top_k < 1:
            raise ValueError(
                "top_k must be at least 1."
            )

        # -----------------------------------------------------
        # STEP 1 — Authenticated user context
        # -----------------------------------------------------

        print("\n=== RETRIEVAL CONTEXT ===")
        print(f"Authenticated user_id  : {user_id}")
        print(f"Authenticated tenant_id: {tenant_id}")
        print(f"Query                  : {query}")
        print("=========================\n")

        # -----------------------------------------------------
        # STEP 2 — Generate query embedding
        # -----------------------------------------------------

        query_embedding = (
            self.embedding_service
            .generate_embedding(query)
        )

        # -----------------------------------------------------
        # STEP 3 — Get ALL ACCESSIBLE documents
        #
        # This now includes:
        #
        #   PRIVATE:
        #       Current user's own documents
        #
        #   TENANT:
        #       Shared documents uploaded by tenant ADMIN
        #
        # It does NOT include:
        #
        #   Other users' PRIVATE documents
        #   Other tenants' documents
        # -----------------------------------------------------

        accessible_documents = (
            self.vector_store
            .get_user_documents(
                user_id=user_id,
                tenant_id=tenant_id,
            )
        )

        print(
            "\n=== AVAILABLE ACCESSIBLE DOCUMENTS ==="
        )

        if not accessible_documents:

            print(
                "No accessible documents found "
                f"(user_id={user_id}, "
                f"tenant_id={tenant_id})."
            )

        else:

            for document in accessible_documents:

                print(
                    f"- "
                    f"{document.get('filename')} "
                    f"| "
                    f"{document.get('document_id')} "
                    f"| "
                    f"visibility="
                    f"{document.get('visibility')}"
                )

        print(
            "=======================================\n"
        )

        # -----------------------------------------------------
        # STEP 4 — Detect document mentioned in query
        # -----------------------------------------------------

        matched_document = (
            self._find_document_match(
                query=query,
                documents=accessible_documents,
            )
        )

        # -----------------------------------------------------
        # STEP 5 — Candidate count
        # -----------------------------------------------------

        candidate_count = max(
            top_k * self.CANDIDATE_MULTIPLIER,
            15,
        )

        # -----------------------------------------------------
        # STEP 6 — Document-aware retrieval
        # -----------------------------------------------------

        if matched_document:

            document_id = (
                matched_document[
                    "document_id"
                ]
            )

            filename = (
                matched_document.get(
                    "filename",
                    "",
                )
            )

            visibility = (
                matched_document.get(
                    "visibility",
                    "",
                )
            )

            print(
                "\n=== DOCUMENT ROUTING ==="
            )

            print(
                f"Query           : {query}"
            )

            print(
                f"Matched document: {filename}"
            )

            print(
                f"Document ID     : {document_id}"
            )

            print(
                f"Visibility      : {visibility}"
            )

            print(
                "Retrieval scope : THIS DOCUMENT ONLY"
            )

            print(
                f"Distance threshold: "
                f"{self.DOCUMENT_THRESHOLD} "
                f"(relaxed for document-specific query)"
            )

            print(
                "=========================\n"
            )

            results = (
                self.vector_store.search(
                    query_embedding=query_embedding,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    top_k=candidate_count,
                    document_id=document_id,
                )
            )

        # -----------------------------------------------------
        # STEP 7 — Normal semantic retrieval
        # -----------------------------------------------------

        else:

            print(
                "\n=== DOCUMENT ROUTING ==="
            )

            print(
                f"Query           : {query}"
            )

            print(
                "No specific document detected."
            )

            print(
                "Using normal semantic retrieval."
            )

            print(
                "Retrieval scope : ALL ACCESSIBLE DOCUMENTS"
            )

            print(
                f"Distance threshold: "
                f"{self.NORMAL_THRESHOLD}"
            )

            print(
                "=========================\n"
            )

            results = (
                self.vector_store.search(
                    query_embedding=query_embedding,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    top_k=candidate_count,
                )
            )

        # -----------------------------------------------------
        # STEP 8 — Extract Chroma results
        # -----------------------------------------------------

        distances = (
            results.get(
                "distances",
                [[]],
            )[0]
        )

        metadatas = (
            results.get(
                "metadatas",
                [[]],
            )[0]
        )

        documents = (
            results.get(
                "documents",
                [[]],
            )[0]
        )

        ids = (
            results.get(
                "ids",
                [[]],
            )[0]
        )

        # -----------------------------------------------------
        # STEP 9 — Debug retrieval
        # -----------------------------------------------------

        print(
            "\n=== RETRIEVAL DISTANCES ==="
        )

        if not distances:
            print(
                "No retrieval results."
            )

        for index, distance in enumerate(
            distances
        ):

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                else {}
            )

            print(
                f"Chunk {index} | "
                f"Distance: {distance:.4f} | "
                f"File: "
                f"{metadata.get('filename')} | "
                f"Visibility: "
                f"{metadata.get('visibility')} | "
                f"Chunk Index: "
                f"{metadata.get('chunk_index')}"
            )

        print(
            "===========================\n"
        )

        # -----------------------------------------------------
        # STEP 10 — No results
        # -----------------------------------------------------

        if not distances:

            return {
                "ids": [[]],
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]],
            }

        # -----------------------------------------------------
        # STEP 11 — Similarity filtering
        # -----------------------------------------------------

        active_threshold = (
            self.DOCUMENT_THRESHOLD
            if matched_document
            else self.NORMAL_THRESHOLD
        )

        valid_indices = [
            index
            for index, distance in enumerate(
                distances
            )
            if distance <= active_threshold
        ]

        valid_indices.sort(
            key=lambda index:
                distances[index]
        )

        filtered_ids = [
            ids[index]
            for index in valid_indices
        ]

        filtered_documents = [
            documents[index]
            for index in valid_indices
        ]

        filtered_metadatas = [
            metadatas[index]
            for index in valid_indices
        ]

        filtered_distances = [
            distances[index]
            for index in valid_indices
        ]

        # -----------------------------------------------------
        # STEP 12 — Deduplicate
        # -----------------------------------------------------

        print("\n=== DEDUPLICATION ===")

        final_results = (
            self._deduplicate_results(
                ids=filtered_ids,
                documents=filtered_documents,
                metadatas=filtered_metadatas,
                distances=filtered_distances,
                top_k=top_k,
            )
        )

        print("=====================\n")

        # -----------------------------------------------------
        # STEP 13 — Final debug
        # -----------------------------------------------------

        final_documents = (
            final_results
            .get("documents", [[]])[0]
        )

        final_metadatas = (
            final_results
            .get("metadatas", [[]])[0]
        )

        final_distances = (
            final_results
            .get("distances", [[]])[0]
        )

        print(
            "\n=== FINAL RETRIEVAL RESULTS ==="
        )

        for index, distance in enumerate(
            final_distances
        ):

            metadata = (
                final_metadatas[index]
                if index < len(final_metadatas)
                else {}
            )

            print(
                f"Result {index} | "
                f"Distance: {distance:.4f} | "
                f"File: "
                f"{metadata.get('filename')} | "
                f"Visibility: "
                f"{metadata.get('visibility')} | "
                f"Chunk: "
                f"{metadata.get('chunk_index')}"
            )

        print(
            f"Total final chunks: "
            f"{len(final_documents)}"
        )

        print(
            "===============================\n"
        )

        return final_results

