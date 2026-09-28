from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import (
    get_current_user,
    require_roles,
)
from app.dependencies.license import (
    require_valid_license_for_editors,
)
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.document_service import save_uploaded_file
from app.services.document_ingestion_service import (
    DocumentIngestionService,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


# ============================================================
# GET DOCUMENTS
# ADMIN / USER / VIEWER
# ============================================================

@router.get(
    "/",
    response_model=list[DocumentResponse],
)
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get documents accessible to the current user.

    ADMIN:
        Can see all documents in the tenant.

    USER / VIEWER:
        Can see:
        - TENANT/shared documents
        - Their own PRIVATE documents

    Cross-tenant documents are never returned.
    """

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a tenant",
        )

    # Role is a SQLAlchemy Role object.
    # The actual role name is available through current_user.role.name.
    if current_user.role.name == "ADMIN":
        documents = (
            db.query(Document)
            .filter(
                Document.tenant_id == current_user.tenant_id,
            )
            .order_by(Document.created_at.desc())
            .all()
        )

    else:
        documents = (
            db.query(Document)
            .filter(
                Document.tenant_id == current_user.tenant_id,
                or_(
                    Document.visibility == "TENANT",
                    Document.user_id == current_user.id,
                ),
            )
            .order_by(Document.created_at.desc())
            .all()
        )

    return documents


# ============================================================
# UPLOAD DOCUMENT
# ADMIN / USER ONLY
# VALID LICENSE REQUIRED
# ============================================================

@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(
        require_valid_license_for_editors
    ),
    db: Session = Depends(get_db),
):
    """
    Upload and process a document.

    ADMIN:
        Uploads TENANT/shared documents.

    USER:
        Uploads PRIVATE documents.

    VIEWER:
        Not allowed.

    Expired license:
        Not allowed.
    """

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a tenant",
        )

    # --------------------------------------------------------
    # Determine document visibility
    # --------------------------------------------------------

    if current_user.role.name == "ADMIN":
        visibility = "TENANT"
    else:
        visibility = "PRIVATE"

    print(
        f"\n[UPLOAD ACCESS] "
        f"user_id={current_user.id} | "
        f"role={current_user.role.name} | "
        f"visibility={visibility}"
    )

    # --------------------------------------------------------
    # Save uploaded file
    # --------------------------------------------------------

    try:
        file_path, file_type = await save_uploaded_file(
            file=file,
            user_id=current_user.id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # --------------------------------------------------------
    # Create document database record
    # --------------------------------------------------------

    document = Document(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        filename=file.filename,
        file_type=file_type,
        file_path=file_path,
        visibility=visibility,
        processed=False,
    )

    db.add(document)

    try:
        db.commit()
        db.refresh(document)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save document record",
        )

    # --------------------------------------------------------
    # Process document and add to RAG knowledge base
    # --------------------------------------------------------

    try:
        from app.services.vector_store import VectorStore

        # ----------------------------------------------------
        # Duplicate guard
        # ----------------------------------------------------

        _vs = VectorStore()

        _existing = _vs.get_user_documents(
            user_id=str(current_user.id),
            tenant_id=str(current_user.tenant_id),
        )

        _existing_filenames = {
            d.get("filename", "").strip().lower()
            for d in _existing
        }

        _new_filename_lower = (
            file.filename or ""
        ).strip().lower()

        if _new_filename_lower in _existing_filenames:
            print(
                f"\n[DUPLICATE WARNING] "
                f"Filename '{file.filename}' is already present "
                f"for this user's accessible documents. "
                f"A second copy will be stored under a new "
                f"document_id={document.id}."
            )

        # ----------------------------------------------------
        # Document ingestion
        # ----------------------------------------------------

        ingestion_service = DocumentIngestionService()

        ingestion_result = ingestion_service.process_document(
            file_path=file_path,
            file_type=file_type,
            document_id=str(document.id),
            user_id=str(current_user.id),
            tenant_id=str(current_user.tenant_id),
            filename=file.filename,
            visibility=visibility,
        )

        print(
            f"\n[UPLOAD] Ingestion complete: "
            f"document_id={ingestion_result['document_id']} | "
            f"filename={ingestion_result['filename']} | "
            f"user_id={ingestion_result['user_id']} | "
            f"tenant_id={ingestion_result['tenant_id']} | "
            f"visibility={visibility} | "
            f"chunks={ingestion_result['chunks']}"
        )

        document.processed = True

        db.commit()
        db.refresh(document)

    except Exception as exc:
        document.processed = False

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {str(exc)}",
        )

    return document


# ============================================================
# DELETE DOCUMENT
# ADMIN / USER ONLY
# ============================================================

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: str,
    current_user: User = Depends(
        require_roles("ADMIN", "USER")
    ),
    db: Session = Depends(get_db),
):
    """
    Delete a document and its associated vector data.

    ADMIN:
        Can delete documents in their tenant.

    USER:
        Can delete only their own documents.

    VIEWER:
        Not allowed.

    The document's Chroma vectors are deleted before
    the database record is removed.
    """

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a tenant",
        )

    # --------------------------------------------------------
    # Find document within current tenant
    # --------------------------------------------------------

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # --------------------------------------------------------
    # USER can delete only own documents
    # ADMIN can delete tenant documents
    # --------------------------------------------------------

    if (
        current_user.role.name != "ADMIN"
        and document.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can delete only your own documents",
        )

    # --------------------------------------------------------
    # Delete vector data from Chroma
    # --------------------------------------------------------

    try:
        from app.services.vector_store import VectorStore

        vector_store = VectorStore()

        vector_store.delete_document_vectors(
            document_id=str(document.id),
            user_id=str(document.user_id),
            tenant_id=str(document.tenant_id),
            visibility=document.visibility,
        )

        print(
            f"\n[DOCUMENT DELETE] "
            f"Vector data deleted | "
            f"document_id={document.id} | "
            f"filename={document.filename} | "
            f"visibility={document.visibility}"
        )

    except Exception as exc:
        print(
            f"\n[DOCUMENT DELETE ERROR] "
            f"Failed to delete vector data | "
            f"document_id={document.id} | "
            f"error={exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document vectors",
        )

    # --------------------------------------------------------
    # Delete physical uploaded file
    # --------------------------------------------------------

    try:
        from pathlib import Path

        file_path = Path(document.file_path)

        if file_path.exists():
            file_path.unlink()

            print(
                f"[DOCUMENT DELETE] "
                f"Physical file deleted | "
                f"path={file_path}"
            )

    except Exception as exc:
        print(
            f"[DOCUMENT DELETE WARNING] "
            f"Could not delete physical file | "
            f"path={document.file_path} | "
            f"error={exc}"
        )

    # --------------------------------------------------------
    # Delete database record
    # --------------------------------------------------------

    try:
        db.delete(document)
        db.commit()

        print(
            f"[DOCUMENT DELETE] "
            f"Database record deleted | "
            f"document_id={document.id}"
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document",
        )

    return None


# ============================================================
# GET DOCUMENT DETAILS
# ADMIN / USER / VIEWER
# ============================================================

@router.get("/{document_id}")
def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get details of an accessible document.
    """

    if current_user.role.name == "ADMIN":
        document = db.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
            )
        )

    else:
        document = db.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                or_(
                    Document.visibility == "TENANT",
                    Document.user_id == current_user.id,
                ),
            )
        )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return {
        "id": str(document.id),
        "filename": document.filename,
        "file_type": document.file_type,
        "visibility": document.visibility,
        "processed": document.processed,
        "uploaded_at": document.created_at,
        "tenant_id": str(document.tenant_id),
    }

