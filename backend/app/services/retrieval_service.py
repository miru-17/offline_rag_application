from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore


class RetrievalService:

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    def retrieve(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
    ):
        if not query or not query.strip():
            raise ValueError(
                "Query cannot be empty."
            )

        # Generate embedding for the user's question
        query_embedding = (
            self.embedding_service.generate_embedding(
                query
            )
        )

        # Search ChromaDB with user-specific filtering
        results = self.vector_store.search(
            query_embedding=query_embedding,
            user_id=user_id,
            top_k=top_k,
        )

        return results