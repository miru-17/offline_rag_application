from app.services.document_processor import (
    extract_text_from_pdf,
)

from app.services.text_splitter import (
    split_text,
)


PDF_PATH = r"D:\Internship\.vscode\offline-rag\backend\uploads\25ec1950-2b2b-43e2-9545-018cfac97d44\51ff9c47-e8bf-40cc-99bc-72ef0e5db11d.pdf"


if __name__ == "__main__":

    # Step 1: Extract PDF text
    text = extract_text_from_pdf(
        PDF_PATH
    )

    print(
        "Extracted characters:",
        len(text),
    )

    # Step 2: Split into chunks
    chunks = split_text(text)

    print(
        "Total chunks:",
        len(chunks),
    )

    print("\n" + "=" * 60)
    print("CHUNK PREVIEW")
    print("=" * 60)

    for index, chunk in enumerate(
        chunks[:5],
        start=1,
    ):
        print(
            f"\n--- Chunk {index} ---"
        )

        print(chunk[:1000])

        print(
            f"\nChunk characters: {len(chunk)}"
        )