from app.services.document_processor import (
    extract_text_from_pdf,
)

from app.services.text_splitter import (
    split_text,
)

from app.services.embedding_service import (
    EmbeddingService,
)

from app.services.vector_store import (
    VectorStore,
)


PDF_PATH = r"D:\Internship\.vscode\offline-rag\backend\uploads\25ec1950-2b2b-43e2-9545-018cfac97d44\51ff9c47-e8bf-40cc-99bc-72ef0e5db11d.pdf"


USER_ID = "25ec1950-2b2b-43e2-9545-018cfac97d44"

DOCUMENT_ID = "test-document-001"

FILENAME = "resume.pdf"


if __name__ == "__main__":

    # -----------------------------------------
    # 1. Extract text
    # -----------------------------------------

    text = extract_text_from_pdf(
        PDF_PATH
    )

    print(
        "Extracted characters:",
        len(text),
    )

    # -----------------------------------------
    # 2. Create chunks
    # -----------------------------------------

    chunks = split_text(text)

    print(
        "Total chunks:",
        len(chunks),
    )

    # -----------------------------------------
    # 3. Generate embeddings
    # -----------------------------------------

    embedding_service = (
        EmbeddingService()
    )

    embeddings = (
        embedding_service.generate_embeddings(
            chunks
        )
    )

    print(
        "Total embeddings:",
        len(embeddings),
    )

    # -----------------------------------------
    # 4. Store in ChromaDB
    # -----------------------------------------

    vector_store = VectorStore()

    stored_count = vector_store.add_chunks(
        chunks=chunks,
        embeddings=embeddings,
        document_id=DOCUMENT_ID,
        user_id=USER_ID,
        filename=FILENAME,
    )

    print(
        "Stored chunks:",
        stored_count,
    )

    print(
        "Total ChromaDB documents:",
        vector_store.count(),
    )