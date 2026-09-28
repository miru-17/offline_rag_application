from app.services.document_processor import extract_text
from app.services.text_splitter import split_text
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore


class DocumentIngestionService:

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    def process_document(
        self,
        file_path: str,
        file_type: str,
        document_id: str,
        user_id: str,
        tenant_id: str,
        filename: str,
        visibility: str,
    ) -> dict:

        print("\n=== DOCUMENT INGESTION START ===")
        print(f"document_id : {document_id}")
        print(f"filename    : {filename}")
        print(f"user_id     : {user_id}")
        print(f"tenant_id   : {tenant_id}")
        print(f"visibility  : {visibility}")
        print(f"file_type   : {file_type}")
        print(f"file_path   : {file_path}")

        # --------------------------------------------------------
        # Validate visibility
        # --------------------------------------------------------

        if visibility not in {"PRIVATE", "TENANT"}:
            raise ValueError(
                f"Invalid document visibility: {visibility}"
            )

        # --------------------------------------------------------
        # Extract text
        # --------------------------------------------------------

        extracted_text = extract_text(
            file_path=file_path,
            file_type=file_type,
        )

        if not extracted_text or not extracted_text.strip():
            raise ValueError(
                "No text could be extracted from document."
            )

        print(
            f"extracted_text length (chars): "
            f"{len(extracted_text)}"
        )

        # --------------------------------------------------------
        # Split into chunks
        # --------------------------------------------------------

        chunks = split_text(extracted_text)

        if not chunks:
            raise ValueError(
                "No chunks generated from document."
            )

        print(f"chunks generated: {len(chunks)}")

        # --------------------------------------------------------
        # Generate embeddings
        # --------------------------------------------------------

        embeddings = (
            self.embedding_service.generate_embeddings(
                chunks
            )
        )

        if not embeddings:
            raise ValueError(
                "No embeddings generated for document."
            )

        if len(chunks) != len(embeddings):
            raise ValueError(
                "Chunks and embeddings count must match."
            )

        print(
            f"embeddings generated: {len(embeddings)}"
        )

        # --------------------------------------------------------
        # Store in vector database
        # --------------------------------------------------------

        stored_count = self.vector_store.add_chunks(
            chunks=chunks,
            embeddings=embeddings,
            document_id=document_id,
            user_id=user_id,
            tenant_id=tenant_id,
            filename=filename,
            visibility=visibility,
        )

        print(
            f"chunks inserted into Chroma: "
            f"{stored_count}"
        )

        print("=== DOCUMENT INGESTION COMPLETE ===\n")

        return {
            "document_id": document_id,
            "filename": filename,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "visibility": visibility,
            "chunks": stored_count,
        }