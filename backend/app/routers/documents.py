from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.document_service import (
    save_uploaded_file,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        file_path, file_type = (
            await save_uploaded_file(
                file=file,
                user_id=current_user.id,
            )
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    document = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_type=file_type,
        file_path=file_path,
        processed=False,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document