"""
RAG Service

Complete RAG generation pipeline:

User Query
    ↓
User + Tenant Validation
    ↓
Retrieval Service
    ↓
Query Embedding
    ↓
User-Specific ChromaDB Similarity Search
    ↓
Tenant + User Filtered Retrieved Chunks
    ↓
Context Builder
    ↓
Prompt Builder
    ↓
Ollama / Local LLM
    ↓
Final Answer + Sources
"""

from app.services.retrieval_service import RetrievalService
from app.services.context_builder import ContextBuilder
from app.services.prompt_builder import build_prompt
from app.services.ollama_service import generate_answer


class RAGService:

    def __init__(self):
        self.retrieval_service = RetrievalService()
        self.context_builder = ContextBuilder()

    def generate_answer(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        top_k: int = 5,
    ) -> dict:
        """
        Generate an answer and source references
        using documents belonging to the current user
        and tenant.
        """

        # --------------------------------------------------
        # 1. Validate user
        # --------------------------------------------------

        if not user_id:
            raise ValueError(
                "User ID is required for RAG."
            )

        # --------------------------------------------------
        # 2. Validate tenant
        # --------------------------------------------------

        if not tenant_id:
            raise ValueError(
                "Tenant ID is required for RAG."
            )

        # --------------------------------------------------
        # 3. Retrieve relevant chunks
        # --------------------------------------------------

        results = self.retrieval_service.retrieve(
            query=query,
            user_id=user_id,
            tenant_id=tenant_id,
            top_k=top_k,
        )

        # --------------------------------------------------
        # 4. Check whether relevant chunks were found
        # --------------------------------------------------

        documents = results.get(
            "documents",
            [[]],
        )[0]

        if not documents:
            return {
                "answer": (
                    "I cannot answer this question as it is "
                    "not in your uploaded documents."
                ),
                "sources": [],
            }

        # --------------------------------------------------
        # 5. Build context
        # --------------------------------------------------

        context = self.context_builder.build_context(
            results
        )

        # --------------------------------------------------
        # 6. Build prompt
        # --------------------------------------------------

        prompt = build_prompt(
            query=query,
            context=context,
        )

        # --------------------------------------------------
        # 7. Generate answer using Ollama
        # --------------------------------------------------

        answer = generate_answer(prompt)

        # --------------------------------------------------
        # 8. Extract source information
        # --------------------------------------------------

        metadatas = results.get(
            "metadatas",
            [[]],
        )[0]

        sources = []
        seen_sources = set()

        for metadata in metadatas:

            if not metadata:
                continue

            # ----------------------------------------------
            # Filename
            # ----------------------------------------------

            filename = (
                metadata.get("filename")
                or metadata.get("file_name")
                or metadata.get("document_name")
                or "Unknown document"
            )

            # ----------------------------------------------
            # Document ID
            # ----------------------------------------------

            document_id = (
                metadata.get("document_id")
                or ""
            )

            # ----------------------------------------------
            # Chunk index
            # ----------------------------------------------

            chunk_index = metadata.get(
                "chunk_index",
                0,
            )

            # ----------------------------------------------
            # Page number
            # ----------------------------------------------

            page = (
                metadata.get("page")
                or metadata.get("page_number")
                or metadata.get("pageNumber")
            )

            if page is None:
                page = metadata.get("source_page")

            # ----------------------------------------------
            # Normalize page number
            # ----------------------------------------------

            if page is not None:
                try:
                    page = int(page)
                except (TypeError, ValueError):
                    page = str(page).strip()

            # ----------------------------------------------
            # Create unique source key
            # ----------------------------------------------

            source_key = (
                str(document_id),
                str(filename).strip().lower(),
                str(page),
            )

            if source_key in seen_sources:
                continue

            seen_sources.add(source_key)

            source = {
                "filename": str(filename).strip(),
                "page": page,
                "chunk_index": chunk_index,
                "document_id": document_id,
            }

            sources.append(source)

        # --------------------------------------------------
        # 9. Return final response
        # --------------------------------------------------

        return {
            "answer": answer,
            "sources": sources,
        }


# --------------------------------------------------
# Local Testing
# --------------------------------------------------

if __name__ == "__main__":

    rag_service = RAGService()

    test_query = (
        "What is backpropagation?"
    )

    test_user_id = (
        "3563baeb-634c-4df8-a907-480f12825e4b"
    )

    test_tenant_id = (
        "53a1856a-d4d1-472d-b6ab-02e5aec46c44"
    )

    result = rag_service.generate_answer(
        query=test_query,
        user_id=test_user_id,
        tenant_id=test_tenant_id,
        top_k=5,
    )

    print("=" * 60)
    print("RAG ANSWER")
    print("=" * 60)

    print(result["answer"])

    print("\n" + "=" * 60)
    print("SOURCES")
    print("=" * 60)

    for source in result["sources"]:
        print(source)