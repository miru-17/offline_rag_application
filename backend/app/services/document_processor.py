from pathlib import Path

from PyPDF2 import PdfReader
from docx import Document
from openpyxl import load_workbook


def extract_text_from_pdf(file_path: str) -> str:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Document not found: {file_path}"
        )

    reader = PdfReader(str(path))

    pages = []

    for page_number, page in enumerate(
        reader.pages,
        start=1,
    ):
        text = page.extract_text() or ""

        if text.strip():
            pages.append(
                f"[Page {page_number}]\n{text.strip()}"
            )

    extracted_text = "\n\n".join(pages)

    if not extracted_text.strip():
        raise ValueError(
            "No readable text found in the PDF."
        )

    return extracted_text


def extract_text_from_docx(file_path: str) -> str:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Document not found: {file_path}"
        )

    document = Document(str(path))

    paragraphs = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if text:
            paragraphs.append(text)

    # Extract table content too
    for table in document.tables:
        for row in table.rows:
            cells = [
                cell.text.strip()
                for cell in row.cells
            ]

            row_text = " | ".join(
                cell for cell in cells if cell
            )

            if row_text:
                paragraphs.append(row_text)

    extracted_text = "\n\n".join(paragraphs)

    if not extracted_text.strip():
        raise ValueError(
            "No readable text found in the DOCX."
        )

    return extracted_text


def extract_text_from_xlsx(file_path: str) -> str:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Document not found: {file_path}"
        )

    workbook = load_workbook(
        filename=str(path),
        read_only=True,
        data_only=True,
    )

    sheets = []

    for worksheet in workbook.worksheets:
        rows = []

        for row in worksheet.iter_rows(
            values_only=True
        ):
            values = [
                str(value).strip()
                for value in row
                if value is not None
            ]

            if values:
                rows.append(
                    " | ".join(values)
                )

        if rows:
            sheets.append(
                f"[Sheet: {worksheet.title}]\n"
                + "\n".join(rows)
            )

    workbook.close()

    extracted_text = "\n\n".join(sheets)

    if not extracted_text.strip():
        raise ValueError(
            "No readable data found in the XLSX."
        )

    return extracted_text


def extract_text(
    file_path: str,
    file_type: str,
) -> str:
    """
    Extract text/data from supported document types.
    """

    normalized_type = file_type.lower().strip()

    if normalized_type == "pdf":
        return extract_text_from_pdf(file_path)

    if normalized_type == "docx":
        return extract_text_from_docx(file_path)

    if normalized_type == "xlsx":
        return extract_text_from_xlsx(file_path)

    raise ValueError(
        f"Unsupported document type: {file_type}"
    )