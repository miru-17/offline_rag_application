from pathlib import Path
import uuid

from fastapi import UploadFile


UPLOAD_ROOT = Path("uploads")

ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
}

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def validate_extension(filename: str) -> str:
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. "
            "Only PDF, DOCX and XLSX files are allowed."
        )

    return ALLOWED_EXTENSIONS[extension]


async def save_uploaded_file(
    file: UploadFile,
    user_id: uuid.UUID,
) -> tuple[str, str]:

    if not file.filename:
        raise ValueError("Filename is required.")

    file_type = validate_extension(file.filename)

    content = await file.read()

    if not content:
        raise ValueError("Uploaded file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise ValueError(
            "File size must not exceed 25 MB."
        )

    # User-specific directory
    user_directory = (
        UPLOAD_ROOT / str(user_id)
    )

    user_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Never trust the original filename for storage
    generated_filename = (
        f"{uuid.uuid4()}.{file_type}"
    )

    file_path = (
        user_directory / generated_filename
    )

    file_path.write_bytes(content)

    return str(file_path), file_type