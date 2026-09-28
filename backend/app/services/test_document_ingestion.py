from app.services.document_ingestion_service import (
    DocumentIngestionService,
)


USER_ID = "3563baeb-634c-4df8-a907-480f12825e4b"

FILE_PATH = (
    "uploads/"
    "3563baeb-634c-4df8-a907-480f12825e4b/"
    "658b0fe1-3fe3-430d-8b2a-0303997024e9.pdf"
)


DOCUMENT_ID = "manual-test-resume-3563"


def main():

    service = DocumentIngestionService()

    result = service.process_document(
        file_path=FILE_PATH,
        file_type="pdf",
        document_id=DOCUMENT_ID,
        user_id=USER_ID,
        filename="resume.pdf",
    )

    print("\n" + "=" * 60)
    print("DOCUMENT INGESTION RESULT")
    print("=" * 60)

    print("Document ID:", result["document_id"])
    print("Filename:", result["filename"])
    print("Chunks stored:", result["chunks"])


if __name__ == "__main__":
    main()