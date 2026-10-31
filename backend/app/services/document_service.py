"""
Upload validation and storage.

A file is accepted only when BOTH its extension and its actual content
(magic bytes / container structure) match an allowed type. A renamed
.exe saved as .pdf is rejected.
"""

from __future__ import annotations

import hashlib
import io
import uuid
import zipfile
from pathlib import Path

from fastapi import UploadFile

from app.core.config import MAX_DATASET_MB, MAX_UPLOAD_MB, UPLOAD_ROOT

DOCUMENT_TYPES = {".pdf": "pdf", ".docx": "docx", ".xlsx": "xlsx",
                  ".png": "png", ".jpg": "jpg", ".jpeg": "jpg"}
DATASET_TYPES = {".csv": "csv", ".xlsx": "xlsx"}

MAX_FILE_SIZE = MAX_UPLOAD_MB * 1024 * 1024
READ_CHUNK = 1024 * 1024

# Zip bombs: refuse Office files that expand far beyond their size.
MAX_UNCOMPRESSED_RATIO = 100
MAX_UNCOMPRESSED_BYTES = 300 * 1024 * 1024


class UploadValidationError(ValueError):
    """The uploaded file is not acceptable. Message is safe to show."""


def validate_extension(filename: str, allowed: dict[str, str] = DOCUMENT_TYPES) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in allowed:
        names = ", ".join(sorted(e.lstrip(".").upper() for e in allowed))
        raise UploadValidationError(f"Unsupported file type. Allowed: {names}.")
    return allowed[extension]


def _check_office_zip(content: bytes, file_type: str) -> None:
    if not content.startswith(b"PK\x03\x04"):
        raise UploadValidationError("The file content does not match its extension.")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = set(archive.namelist())
            total = sum(info.file_size for info in archive.infolist())
    except zipfile.BadZipFile:
        raise UploadValidationError("The file is damaged or not a valid Office document.")

    if "[Content_Types].xml" not in names:
        raise UploadValidationError("The file is not a valid Office document.")

    expected_prefix = "word/" if file_type == "docx" else "xl/"
    if not any(name.startswith(expected_prefix) for name in names):
        raise UploadValidationError("The file content does not match its extension.")

    if total > MAX_UNCOMPRESSED_BYTES or total > max(len(content), 1) * MAX_UNCOMPRESSED_RATIO:
        raise UploadValidationError("The file expands to an unsafe size and was rejected.")

    if any(name.lower().endswith(("vbaproject.bin",)) for name in names):
        raise UploadValidationError("Files containing macros are not accepted.")


def _check_csv(content: bytes) -> None:
    sample = content[:65536]
    if b"\x00" in sample:
        raise UploadValidationError("The CSV file contains binary data.")
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            sample.decode(encoding)
            return
        except UnicodeDecodeError:
            continue
    raise UploadValidationError("The CSV file encoding is not supported.")


def validate_content(content: bytes, file_type: str) -> None:
    if file_type == "pdf":
        if not content[:1024].lstrip().startswith(b"%PDF-"):
            raise UploadValidationError("The file content does not match its extension.")
    elif file_type in {"docx", "xlsx"}:
        _check_office_zip(content, file_type)
    elif file_type == "csv":
        _check_csv(content)
    elif file_type == "png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise UploadValidationError("The file content does not match its extension.")
    elif file_type == "jpg":
        if not content.startswith(b"\xff\xd8\xff"):
            raise UploadValidationError("The file content does not match its extension.")
    else:
        raise UploadValidationError("Unsupported file type.")


async def read_upload(file: UploadFile, max_bytes: int) -> bytes:
    """Read the upload in pieces and stop as soon as it is too large."""
    buffer = bytearray()
    while True:
        piece = await file.read(READ_CHUNK)
        if not piece:
            break
        buffer.extend(piece)
        if len(buffer) > max_bytes:
            raise UploadValidationError(
                f"File size must not exceed {max_bytes // (1024 * 1024)} MB."
            )
    if not buffer:
        raise UploadValidationError("Uploaded file is empty.")
    return bytes(buffer)


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def store_bytes(content: bytes, owner_id, file_type: str, subdir: str = "") -> str:
    directory = UPLOAD_ROOT / subdir / str(owner_id) if subdir else UPLOAD_ROOT / str(owner_id)
    directory.mkdir(parents=True, exist_ok=True)
    # Never trust the original filename for storage.
    path = directory / f"{uuid.uuid4()}.{file_type}"
    path.write_bytes(content)
    return str(path)


def safe_display_name(filename: str | None) -> str:
    name = Path(filename or "document").name.strip()
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '<>:"/\\|?*')
    return (name or "document")[:200]


async def save_uploaded_file(
    file: UploadFile,
    user_id: uuid.UUID,
    allowed: dict[str, str] = DOCUMENT_TYPES,
    max_bytes: int = MAX_FILE_SIZE,
    subdir: str = "",
) -> dict:
    """Validate and store an upload. Returns path, type, size, hash, name."""

    if not file.filename:
        raise UploadValidationError("Filename is required.")

    file_type = validate_extension(file.filename, allowed)
    content = await read_upload(file, max_bytes)
    validate_content(content, file_type)

    return {
        "file_path": store_bytes(content, user_id, file_type, subdir),
        "file_type": file_type,
        "file_size": len(content),
        "content_hash": sha256(content),
        "filename": safe_display_name(file.filename),
    }


DATASET_MAX_BYTES = MAX_DATASET_MB * 1024 * 1024
