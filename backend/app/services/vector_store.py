from pathlib import Path

import chromadb


CHROMA_PATH = Path("chroma_db")


class VectorStore:

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=str(CHROMA_PATH)
        )

    # ============================================================
    # PRIVATE USER COLLECTION
    # ============================================================

    def _get_user_collection(self, user_id: str):
        if not user_id:
            raise ValueError("User ID is required.")

        collection_name = f"user_{user_id}"

        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    # ============================================================
    # TENANT SHARED COLLECTION
    # ============================================================

    def _get_shared_collection(self, tenant_id: str):
        if not tenant_id:
            raise ValueError("Tenant ID is required.")

        collection_name = f"tenant_shared_{tenant_id}"

        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    # ============================================================
    # ADD CHUNKS
    # ============================================================

    def add_chunks(
        self,
        chunks,
        embeddings,
        document_id,
        user_id,
        tenant_id,
        filename,
        visibility,
    ):
        if not chunks:
            raise ValueError("Chunks cannot be empty.")

        if not embeddings:
            raise ValueError("Embeddings cannot be empty.")

        if len(chunks) != len(embeddings):
            raise ValueError(
                "Chunks and embeddings count must match."
            )

        if visibility not in {"PRIVATE", "TENANT"}:
            raise ValueError(
                f"Invalid visibility: {visibility}"
            )

        # --------------------------------------------------------
        # Select collection based on visibility
        # --------------------------------------------------------

        if visibility == "TENANT":
            collection = self._get_shared_collection(
                tenant_id=tenant_id
            )

            storage_scope = (
                f"tenant_shared_{tenant_id}"
            )

        else:
            collection = self._get_user_collection(
                user_id=user_id
            )

            storage_scope = f"user_{user_id}"

        print(
            f"[VECTOR STORE] Adding chunks | "
            f"scope={storage_scope} | "
            f"visibility={visibility}"
        )

        # --------------------------------------------------------
        # IDs
        # --------------------------------------------------------

        ids = [
            f"{document_id}_{index}"
            for index in range(len(chunks))
        ]

        # --------------------------------------------------------
        # Metadata
        # --------------------------------------------------------

        metadatas = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "filename": filename,
                "chunk_index": index,
                "visibility": visibility,
            }
            for index in range(len(chunks))
        ]

        # --------------------------------------------------------
        # Store
        # --------------------------------------------------------

        collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        return len(chunks)

    # ============================================================
    # SEARCH
    # ============================================================

    def search(
        self,
        query_embedding,
        user_id,
        tenant_id,
        top_k=5,
        document_id=None,
    ):
        if not user_id:
            raise ValueError("User ID is required.")

        if not tenant_id:
            raise ValueError("Tenant ID is required.")

        print(
            f"\n[VECTOR SEARCH] "
            f"tenant_id={tenant_id} | "
            f"user_id={user_id} | "
            f"document_id={document_id or 'ALL'} | "
            f"top_k={top_k}"
        )

        all_results = []

        # ========================================================
        # 1. SEARCH USER'S PRIVATE DOCUMENTS
        # ========================================================

        user_collection = self._get_user_collection(
            user_id=user_id
        )

        user_count = user_collection.count()

        if user_count > 0:

            safe_top_k = min(
                top_k,
                user_count,
            )

            private_filters = [
                {"tenant_id": tenant_id},
                {"user_id": user_id},
                {"visibility": "PRIVATE"},
            ]

            if document_id:
                private_filters.append(
                    {"document_id": document_id}
                )

            private_results = user_collection.query(
                query_embeddings=[query_embedding],
                n_results=safe_top_k,
                where={
                    "$and": private_filters
                },
            )

            all_results.append(private_results)

            print(
                f"[VECTOR SEARCH] "
                f"Private collection=user_{user_id} | "
                f"results={len(private_results.get('ids', [[]])[0])}"
            )

        # ========================================================
        # 2. SEARCH TENANT SHARED DOCUMENTS
        # ========================================================

        shared_collection = self._get_shared_collection(
            tenant_id=tenant_id
        )

        shared_count = shared_collection.count()

        if shared_count > 0:

            safe_top_k = min(
                top_k,
                shared_count,
            )

            shared_filters = [
                {"tenant_id": tenant_id},
                {"visibility": "TENANT"},
            ]

            if document_id:
                shared_filters.append(
                    {"document_id": document_id}
                )

            shared_results = shared_collection.query(
                query_embeddings=[query_embedding],
                n_results=safe_top_k,
                where={
                    "$and": shared_filters
                },
            )

            all_results.append(shared_results)

            print(
                f"[VECTOR SEARCH] "
                f"Shared collection="
                f"tenant_shared_{tenant_id} | "
                f"results={len(shared_results.get('ids', [[]])[0])}"
            )

        # ========================================================
        # 3. MERGE RESULTS
        # ========================================================

        merged = []

        for result in all_results:

            ids = result.get("ids", [[]])[0]
            documents = result.get("documents", [[]])[0]
            metadatas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]

            for index in range(len(ids)):

                merged.append(
                    {
                        "id": ids[index],
                        "document": documents[index],
                        "metadata": metadatas[index],
                        "distance": distances[index],
                    }
                )

        # --------------------------------------------------------
        # Sort by similarity distance
        # Lower distance = more similar
        # --------------------------------------------------------

        merged.sort(
            key=lambda item: item["distance"]
        )

        merged = merged[:top_k]

        # ========================================================
        # 4. RETURN CHROMA-COMPATIBLE FORMAT
        # ========================================================

        return {
            "ids": [
                [
                    item["id"]
                    for item in merged
                ]
            ],
            "documents": [
                [
                    item["document"]
                    for item in merged
                ]
            ],
            "metadatas": [
                [
                    item["metadata"]
                    for item in merged
                ]
            ],
            "distances": [
                [
                    item["distance"]
                    for item in merged
                ]
            ],
        }

    # ============================================================
    # GET ACCESSIBLE DOCUMENTS
    # ============================================================

    def get_user_documents(
        self,
        user_id: str,
        tenant_id: str,
    ):
        """
        Return documents accessible to this user:

        1. User's PRIVATE documents
        2. Tenant's TENANT/shared documents
        """

        documents = {}

        # --------------------------------------------------------
        # PRIVATE USER DOCUMENTS
        # --------------------------------------------------------

        user_collection = self._get_user_collection(
            user_id=user_id
        )

        if user_collection.count() > 0:

            private_results = user_collection.get(
                where={
                    "$and": [
                        {"tenant_id": tenant_id},
                        {"user_id": user_id},
                        {"visibility": "PRIVATE"},
                    ]
                },
                include=["metadatas"],
            )

            for metadata in (
                private_results.get("metadatas") or []
            ):
                if not metadata:
                    continue

                document_id = metadata.get(
                    "document_id"
                )

                if document_id:
                    documents[document_id] = metadata

        # --------------------------------------------------------
        # TENANT SHARED DOCUMENTS
        # --------------------------------------------------------

        shared_collection = self._get_shared_collection(
            tenant_id=tenant_id
        )

        if shared_collection.count() > 0:

            shared_results = shared_collection.get(
                where={
                    "$and": [
                        {"tenant_id": tenant_id},
                        {"visibility": "TENANT"},
                    ]
                },
                include=["metadatas"],
            )

            for metadata in (
                shared_results.get("metadatas") or []
            ):
                if not metadata:
                    continue

                document_id = metadata.get(
                    "document_id"
                )

                if document_id:
                    documents[document_id] = metadata

        return list(documents.values())

    # ============================================================
    # DELETE VECTOR DATA
    # ============================================================

    def delete_document_vectors(
        self,
        document_id: str,
        user_id: str,
        tenant_id: str,
        visibility: str,
    ):
        """
        Delete all Chroma chunks belonging to a document.
        """

        if visibility == "TENANT":

            collection = self._get_shared_collection(
                tenant_id=tenant_id
            )

            print(
                f"[VECTOR DELETE] "
                f"shared collection="
                f"tenant_shared_{tenant_id} | "
                f"document_id={document_id}"
            )

        else:

            collection = self._get_user_collection(
                user_id=user_id
            )

            print(
                f"[VECTOR DELETE] "
                f"user collection=user_{user_id} | "
                f"document_id={document_id}"
            )

        if collection.count() == 0:
            return

        collection.delete(
            where={
                "$and": [
                    {"document_id": document_id},
                    {"tenant_id": tenant_id},
                ]
            }
        )