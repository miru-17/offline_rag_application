from pathlib import Path

import chromadb


# Store ChromaDB data inside the backend project
CHROMA_PATH = Path("chroma_db")


class VectorStore:

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=str(CHROMA_PATH)
        )

        self.collection = (
            self.client.get_or_create_collection(
                name="document_chunks",
                metadata={
                    "hnsw:space": "cosine"
                },
            )
        )

    def add_chunks(
        self,
        chunks: list[str],
        embeddings: list[list[float]],
        document_id: str,
        user_id: str,
        filename: str,
    ) -> int:

        if not chunks:
            raise ValueError(
                "Chunks cannot be empty."
            )

        if len(chunks) != len(embeddings):
            raise ValueError(
                "Chunks and embeddings count must match."
            )

        ids = [
            f"{document_id}_{index}"
            for index in range(len(chunks))
        ]

        metadatas = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "filename": filename,
                "chunk_index": index,
            }
            for index in range(len(chunks))
        ]

        self.collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        return len(chunks)

    def search(
        self,
        query_embedding: list[float],
        user_id: str,
        top_k: int = 5,
    ):
        results = self.collection.query(
            query_embeddings=[
                query_embedding
            ],
            n_results=top_k,
            where={
                "user_id": user_id
            },
        )

        return results

    def count(self) -> int:
        return self.collection.count()