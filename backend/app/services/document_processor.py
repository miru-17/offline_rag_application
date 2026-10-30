"""
Text extraction.

extract_segments() returns the text in pieces that remember where they came
from (PDF page or Excel sheet), so answers can cite the exact page.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from docx import Document
from openpyxl import load_workbook
from pypdf import PdfReader

from app.core.config import MAX_PDF_PAGES


class ExtractionError(ValueError):
    """Text could not be extracted. Message is safe to show to users."""


@dataclass
class Segment:
    text: str
    page: int | None = None
    sheet: str | None = None

    @property
    def label(self) -> str:
        if self.page is not None:
            return f"Page {self.page}"
        if self.sheet:
            return f"Sheet {self.sheet}"
        return ""


def _require(path: str) -> Path:
    file_path = Path(path)
    if not file_path.exists():
        raise ExtractionError("The stored file could not be found.")
    return file_path


def _pdf_segments(file_path: str) -> list[Segment]:
    try:
        reader = PdfReader(str(_require(file_path)))
        if reader.is_encrypted:
            raise ExtractionError("Password-protected PDFs are not supported.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ExtractionError(f"PDFs longer than {MAX_PDF_PAGES} pages are not supported.")
        segments = []
        for number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                segments.append(Segment(text=text, page=number))
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("The PDF could not be read. It may be damaged.")

    if not segments:
        raise ExtractionError(
            "No readable text found in the PDF. Scanned PDFs need OCR, which is not enabled."
        )
    return segments


def _docx_segments(file_path: str) -> list[Segment]:
    try:
        document = Document(str(_require(file_path)))
        parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
        for table in document.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                row_text = " | ".join(cell for cell in cells if cell)
                if row_text:
                    parts.append(row_text)
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("The DOCX could not be read. It may be damaged.")

    text = "\n\n".join(parts)
    if not text.strip():
        raise ExtractionError("No readable text found in the DOCX.")
    return [Segment(text=text)]


def _xlsx_segments(file_path: str) -> list[Segment]:
    try:
        workbook = load_workbook(filename=str(_require(file_path)), read_only=True, data_only=True)
        segments = []
        for worksheet in workbook.worksheets:
            rows = []
            for row in worksheet.iter_rows(values_only=True):
                values = [str(v).strip() for v in row if v is not None and str(v).strip()]
                if values:
                    rows.append(" | ".join(values))
            if rows:
                segments.append(Segment(text="\n".join(rows), sheet=worksheet.title))
        workbook.close()
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("The XLSX could not be read. It may be damaged.")

    if not segments:
        raise ExtractionError("No readable data found in the XLSX.")
    return segments


def extract_segments(file_path: str, file_type: str) -> list[Segment]:
    kind = (file_type or "").lower().strip()
    if kind == "pdf":
        return _pdf_segments(file_path)
    if kind == "docx":
        return _docx_segments(file_path)
    if kind == "xlsx":
        return _xlsx_segments(file_path)
    raise ExtractionError("Unsupported document type.")


def extract_text(file_path: str, file_type: str) -> str:
    """Whole document as one string, with page / sheet markers."""
    parts = []
    for segment in extract_segments(file_path, file_type):
        parts.append(f"[{segment.label}]\n{segment.text}" if segment.label else segment.text)
    return "\n\n".join(parts)
