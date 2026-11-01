from app.services.ollama_service import model_for_tenant, with_model
import csv
import io
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import QUERY_RATE_LIMIT, UPLOAD_RATE_LIMIT
from app.core.rate_limit import limiter
from app.database.connection import get_db
from app.dependencies.auth import is_admin
from app.dependencies.license import require_feature, require_feature_read
from app.models.dataset import Dataset
from app.models.user import User
from app.services import audit_service
from app.services.access import readable_datasets_clause
from app.services.analytics_service import (
    AggregateSpec,
    AnalyticsError,
    build_dashboard,
    describe_result,
    list_sheets,
    load_dataset,
    preview_rows,
    question_to_spec,
    run_aggregate,
)
from app.services.csv_safety import safe_cell
from app.services.document_service import (
    DATASET_MAX_BYTES,
    DATASET_TYPES,
    UploadValidationError,
    save_uploaded_file,
)
from app.services.ollama_service import LLMError

router = APIRouter(prefix="/datasets", tags=["Data dashboard"])

viewer_access = require_feature("analytics")
# Viewing and exporting stay available after the licence expires (read-only mode).
viewer_read = require_feature_read("analytics")
editor_access = require_feature("analytics", "ADMIN", "USER")


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


def _serialize(dataset: Dataset) -> dict:
    return {
        "id": str(dataset.id),
        "name": dataset.name,
        "file_type": dataset.file_type,
        "sheet_name": dataset.sheet_name,
        "row_count": dataset.row_count,
        "columns": dataset.columns,
        "visibility": dataset.visibility,
        "origin": dataset.origin,
        "file_size": dataset.file_size,
        "created_at": dataset.created_at,
        "owner_id": str(dataset.user_id),
    }


def _get_dataset(db: Session, user: User, dataset_id: UUID) -> Dataset:
    dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id, readable_datasets_clause(user)))
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return dataset


async def _load(dataset: Dataset):
    try:
        return await run_in_threadpool(load_dataset, dataset.file_path, dataset.file_type, dataset.sheet_name)
    except AnalyticsError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/")
def list_datasets(current_user: User = Depends(viewer_read), db: Session = Depends(get_db)):
    datasets = db.scalars(
        select(Dataset).where(readable_datasets_clause(current_user)).order_by(Dataset.created_at.desc())
    ).all()
    return [_serialize(d) for d in datasets]


@router.post("/upload", status_code=status.HTTP_201_CREATED)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_dataset(
    request: Request,
    file: UploadFile = File(...),
    sheet_name: str | None = Form(None, max_length=100),
    shared: bool = Form(False),
    current_user: User = Depends(editor_access),
    db: Session = Depends(get_db),
):
    if shared and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only administrators can share tables with everyone.")

    try:
        stored = await save_uploaded_file(file, current_user.id, allowed=DATASET_TYPES,
                                          max_bytes=DATASET_MAX_BYTES, subdir="datasets")
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        if stored["file_type"] == "xlsx":
            sheets = await run_in_threadpool(list_sheets, stored["file_path"])
            if sheet_name and sheet_name not in sheets:
                raise AnalyticsError(f"Sheet '{sheet_name}' was not found. Sheets: {', '.join(sheets)}.")
            sheet_name = sheet_name or sheets[0]
        else:
            sheet_name = None
        frame, columns = await run_in_threadpool(load_dataset, stored["file_path"], stored["file_type"], sheet_name)
    except AnalyticsError as exc:
        Path(stored["file_path"]).unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        Path(stored["file_path"]).unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="The table could not be read.")

    dataset = Dataset(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        name=stored["filename"] + (f" – {sheet_name}" if sheet_name else ""),
        file_path=stored["file_path"],
        file_type=stored["file_type"],
        sheet_name=sheet_name,
        file_size=stored["file_size"],
        content_hash=stored["content_hash"],
        row_count=int(len(frame)),
        columns=columns,
        visibility="TENANT" if shared else "PRIVATE",
        origin="upload",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    audit_service.record("dataset.uploaded", actor=current_user, target_type="dataset", target_id=dataset.id,
                         target_label=dataset.name, details={"rows": dataset.row_count, "shared": shared},
                         request=request)
    return _serialize(dataset)


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: UUID, current_user: User = Depends(viewer_read), db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    frame, _ = await _load(dataset)
    return {**_serialize(dataset), "preview": preview_rows(frame)}


@router.get("/{dataset_id}/dashboard")
async def dataset_dashboard(dataset_id: UUID, current_user: User = Depends(viewer_read),
                            db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    frame, columns = await _load(dataset)
    try:
        dashboard = await run_in_threadpool(build_dashboard, frame, columns)
    except AnalyticsError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"dataset": _serialize(dataset), **dashboard}


@router.post("/{dataset_id}/aggregate")
async def aggregate(dataset_id: UUID, spec: AggregateSpec, current_user: User = Depends(viewer_read),
                    db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    frame, columns = await _load(dataset)
    try:
        return await run_in_threadpool(run_aggregate, frame, columns, spec)
    except AnalyticsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{dataset_id}/ask")
@limiter.limit(QUERY_RATE_LIMIT)
async def ask_dataset(request: Request, dataset_id: UUID, payload: AskRequest,
                      current_user: User = Depends(viewer_access), db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    frame, columns = await _load(dataset)
    try:
        spec = await run_in_threadpool(with_model(model_for_tenant(current_user.tenant), question_to_spec),
                                      payload.question, columns)
        result = await run_in_threadpool(run_aggregate, frame, columns, spec)
    except AnalyticsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LLMError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    chart = "line" if result["label_column"] and any(
        c["name"] == result["label_column"] and c["kind"] == "date" for c in columns) else "bar"
    return {"question": payload.question, "answer": describe_result(result, spec), "chart": chart, **result}


@router.post("/{dataset_id}/export")
async def export_aggregate(request: Request, dataset_id: UUID, spec: AggregateSpec,
                           current_user: User = Depends(viewer_read), db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    frame, columns = await _load(dataset)
    try:
        result = await run_in_threadpool(run_aggregate, frame, columns, spec)
    except AnalyticsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([safe_cell(result["label_column"] or "Group"), safe_cell(result["value_label"])])
    for row in result["rows"]:
        writer.writerow([safe_cell(row["label"]), safe_cell(row["value"])])

    audit_service.record("dataset.exported", actor=current_user, target_type="dataset", target_id=dataset.id,
                         target_label=dataset.name, request=request)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=ragentis-export.csv"})


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(request: Request, dataset_id: UUID, current_user: User = Depends(editor_access),
                   db: Session = Depends(get_db)):
    dataset = _get_dataset(db, current_user, dataset_id)
    if dataset.user_id != current_user.id and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="You can delete only your own tables.")
    Path(dataset.file_path).unlink(missing_ok=True)
    name = dataset.name
    db.delete(dataset)
    db.commit()
    audit_service.record("dataset.deleted", actor=current_user, target_type="dataset", target_id=dataset_id,
                         target_label=name, request=request)
    return None
