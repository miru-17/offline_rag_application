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

from app.core.config import MAX_PDF_PAGES, OCR_DPI, OCR_ENABLED, OCR_LANGUAGES, OCR_MAX_PAGES
from app.core.logging import get_logger

logger = get_logger("extraction")

# A page with less text than this is treated as scanned and sent to OCR.
OCR_MIN_CHARS = 25


class ExtractionError(ValueError):
    """Text could not be extracted. Message is safe to show to users."""


@dataclass
class Segment:
    text: str
    page: int | None = None
    sheet: str | None = None
    ocr: bool = False

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


def ocr_available() -> bool:
    if not OCR_ENABLED:
        return False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _ocr_image(image) -> str:
    import pytesseract

    return pytesseract.image_to_string(image, lang=OCR_LANGUAGES, timeout=120).strip()


def _ocr_pdf_pages(file_path: str, page_numbers: list[int]) -> dict[int, str]:
    """Render scanned pages to images and read them with Tesseract."""
    import pypdfium2 as pdfium

    results: dict[int, str] = {}
    document = pdfium.PdfDocument(file_path)
    try:
        for number in page_numbers[:OCR_MAX_PAGES]:
            page = document[number - 1]
            image = page.render(scale=OCR_DPI / 72).to_pil()
            try:
                results[number] = _ocr_image(image)
            finally:
                image.close()
                page.close()
    finally:
        document.close()
    return results


def _pdf_segments(file_path: str) -> list[Segment]:
    try:
        reader = PdfReader(str(_require(file_path)))
        if reader.is_encrypted:
            raise ExtractionError("Password-protected PDFs are not supported.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ExtractionError(f"PDFs longer than {MAX_PDF_PAGES} pages are not supported.")
        texts = [(page.extract_text() or "").strip() for page in reader.pages]
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("The PDF could not be read. It may be damaged.")

    scanned = [i + 1 for i, text in enumerate(texts) if len(text) < OCR_MIN_CHARS]
    ocr_text: dict[int, str] = {}
    if scanned and ocr_available():
        try:
            ocr_text = _ocr_pdf_pages(file_path, scanned)
        except Exception:
            logger.exception("OCR failed")

    segments = []
    for number, text in enumerate(texts, start=1):
        if number in ocr_text and len(ocr_text[number]) > len(text):
            segments.append(Segment(text=ocr_text[number], page=number, ocr=True))
        elif text:
            segments.append(Segment(text=text, page=number))

    if not segments:
        hint = (
            "OCR found no text either; the scan may be too blurry."
            if scanned and ocr_available()
            else "Scanned PDFs need OCR, which is not available on this server."
        )
        raise ExtractionError(f"No readable text found in the PDF. {hint}")
    return segments


def _image_segments(file_path: str) -> list[Segment]:
    if not ocr_available():
        raise ExtractionError("Images need OCR, which is not available on this server.")
    from PIL import Image

    try:
        with Image.open(_require(file_path)) as image:
            image.load()
            if image.width * image.height > 60_000_000:
                raise ExtractionError("The image is too large.")
            text = _ocr_image(image.convert("RGB"))
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("The image could not be read.")
    if not text:
        raise ExtractionError("No readable text found in the image.")
    return [Segment(text=text, page=1, ocr=True)]


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
    if kind in {"png", "jpg"}:
        return _image_segments(file_path)
    raise ExtractionError("Unsupported document type.")


def extract_text(file_path: str, file_type: str) -> str:
    """Whole document as one string, with page / sheet markers."""
    parts = []
    for segment in extract_segments(file_path, file_type):
        parts.append(f"[{segment.label}]\n{segment.text}" if segment.label else segment.text)
    return "\n\n".join(parts)
