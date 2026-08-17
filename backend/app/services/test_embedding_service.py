from app.services.document_processor import (
    extract_text_from_pdf,
)

from app.services.text_splitter import (
    split_text,
)

from app.services.embedding_service import (
    EmbeddingService,
)


PDF_PATH = r"D:\Internship\.vscode\offline-rag\backend\uploads\25ec1950-2b2b-43e2-9545-018cfac97d44\51ff9c47-e8bf-40cc-99bc-72ef0e5db11d.pdf"


if __name__ == "__main__":

    # Extract
    text = extract_text_from_pdf(
        PDF_PATH
    )

    # Chunk
    chunks = split_text(text)

    print(
        "Total chunks:",
        len(chunks),
    )

    # Embeddings
    embedding_service = EmbeddingService()

    embeddings = (
        embedding_service.generate_embeddings(
            chunks
        )
    )

    print(
        "Total embeddings:",
        len(embeddings),
    )

    print(
        "Embedding dimensions:",
        len(embeddings[0]),
    )

    print("\nFirst embedding:")
    print(embeddings[0][:10])