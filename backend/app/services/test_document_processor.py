from app.services.document_processor import (
    extract_text_from_pdf,
)


PDF_PATH = r"D:\Internship\.vscode\offline-rag\backend\uploads\25ec1950-2b2b-43e2-9545-018cfac97d44\51ff9c47-e8bf-40cc-99bc-72ef0e5db11d.pdf"


if __name__ == "__main__":
    text = extract_text_from_pdf(PDF_PATH)

    print("=" * 60)
    print("PDF TEXT EXTRACTION SUCCESSFUL")
    print("=" * 60)

    print(text[:3000])

    print("\n")
    print("Total characters:", len(text))