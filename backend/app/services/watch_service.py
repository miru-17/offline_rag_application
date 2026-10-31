"""
Watched folder: files dropped into WATCH_FOLDER are uploaded automatically.

  WATCH_FOLDER/report.pdf          -> shared with the whole organisation
  WATCH_FOLDER/HR/policy.docx      -> shared with the "HR" team space
                                      (a sub-folder named after an existing team space)

A file is picked up only after its size and modification time have stayed the
same for one scan (so half-copied files are not read). When a file changes,
the new content becomes a new version of the same document; unchanged files
are skipped. Files are owned by WATCH_OWNER (a username) or the first admin.
Nothing in the watched folder is ever modified or deleted.
"""

from __future__ import annotations

import threading
import time
from pathlib import Path

from sqlalchemy import func, select

from app.core.config import MAX_UPLOAD_MB, WATCH_FOLDER, WATCH_INTERVAL_SECONDS, WATCH_OWNER
from app.core.logging import get_logger
from app.database.connection import SessionLocal
from app.models.document import Document
from app.models.group import Group
from app.models.role import Role
from app.models.user import User
from app.services import audit_service, document_ingestion_service as ingestion
from app.services.document_service import (
    DOCUMENT_TYPES,
    UploadValidationError,
    safe_display_name,
    sha256,
    store_bytes,
    validate_content,
)
from app.services.license_service import LicenseService

logger = get_logger("watch")

MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
IGNORED_PREFIXES = (".", "~$", "~")
IGNORED_SUFFIXES = (".tmp", ".part", ".crdownload")


class FolderWatcher:
    def __init__(self, root: Path, interval: float):
        self.root = root
        self.interval = max(1.0, float(interval))
        self._seen: dict[str, tuple[int, float]] = {}     # path -> (size, mtime) at last scan
        self._done: dict[str, tuple[int, float]] = {}     # path -> (size, mtime) already handled
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_scan: float | None = None
        self.last_error: str | None = None

    # ---------------- lifecycle ----------------
    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="ragentis-watch", daemon=True)
        self._thread.start()
        logger.info("Watching folder", extra={"fields": {"folder": str(self.root)}})

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self.scan()
                self.last_error = None
            except Exception as exc:     # keep watching even if one scan fails
                self.last_error = str(exc)[:200]
                logger.exception("Watched-folder scan failed")
            self._stop.wait(self.interval)

    # ---------------- scanning ----------------
    def _candidates(self):
        if not self.root.is_dir():
            return
        for path in self.root.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(self.root)
            if len(relative.parts) > 2:               # root or one team-space level only
                continue
            if any(part.startswith(IGNORED_PREFIXES) for part in relative.parts):
                continue
            if path.suffix.lower() in IGNORED_SUFFIXES or path.suffix.lower() not in DOCUMENT_TYPES:
                continue
            yield path, relative.as_posix()

    def scan(self) -> int:
        """One pass over the folder. Returns the number of documents queued."""
        self.last_scan = time.time()
        queued = 0
        current: dict[str, tuple[int, float]] = {}
        for path, relative in self._candidates() or []:
            try:
                stat = path.stat()
            except OSError:
                continue
            signature = (stat.st_size, stat.st_mtime)
            current[relative] = signature
            if self._done.get(relative) == signature:
                continue
            if self._seen.get(relative) != signature:
                continue                               # still changing – wait for the next scan
            if self._ingest(path, relative):
                queued += 1
            self._done[relative] = signature
        self._seen = current
        return queued

    # ---------------- ingest one file ----------------
    def _owner(self, db) -> User | None:
        if WATCH_OWNER:
            return db.scalar(select(User).where(User.username == WATCH_OWNER, User.is_active.is_(True)))
        return db.scalar(
            select(User).join(Role, Role.id == User.role_id)
            .where(Role.name == "ADMIN", User.is_active.is_(True))
            .order_by(User.username.asc())
            .limit(1)
        )

    def _ingest(self, path: Path, relative: str) -> bool:
        db = SessionLocal()
        try:
            owner = self._owner(db)
            if owner is None:
                logger.warning("Watched folder has no owner account (set WATCH_OWNER)")
                return False
            if not LicenseService.evaluate(db, owner.tenant_id, record_time=False).usable:
                logger.warning("Watched folder paused: licence is not valid")
                return False

            if path.stat().st_size > MAX_BYTES or path.stat().st_size == 0:
                return False
            content = path.read_bytes()
            file_type = DOCUMENT_TYPES[path.suffix.lower()]
            try:
                validate_content(content, file_type)
            except UploadValidationError as exc:
                audit_service.record("document.upload_rejected", tenant_id=owner.tenant_id, outcome="failure",
                                     actor_username="watched-folder", target_label=relative[:200],
                                     details={"reason": str(exc)})
                return False
            content_hash = sha256(content)
            source = f"watch:{relative}"

            latest = db.scalar(
                select(Document)
                .where(Document.tenant_id == owner.tenant_id, Document.source_path == source,
                       Document.status != "superseded")
                .order_by(Document.version.desc())
                .limit(1)
            )
            if latest is not None and latest.content_hash == content_hash:
                return False                          # unchanged
            if latest is not None and latest.status in {"queued", "processing"}:
                return False                          # try again next scan

            visibility, group = "TENANT", None
            parts = relative.split("/")
            if len(parts) == 2:
                group = db.scalar(select(Group).where(Group.tenant_id == owner.tenant_id,
                                                      func.lower(Group.name) == parts[0].lower()))
                if group is None:
                    logger.info("Watched sub-folder has no matching team space; sharing with organisation",
                                extra={"fields": {"folder": parts[0]}})
                else:
                    visibility = "GROUP"

            document = Document(
                user_id=owner.id,
                tenant_id=owner.tenant_id,
                filename=safe_display_name(path.name),
                file_type=file_type,
                file_path=store_bytes(content, owner.id, file_type),
                file_size=len(content),
                content_hash=content_hash,
                visibility=latest.visibility if latest else visibility,
                group_id=(latest.group_id if latest else (group.id if group else None)),
                processed=False,
                status="queued",
                version=(latest.version + 1) if latest else 1,
                replaces_document_id=latest.id if latest else None,
                source_path=source,
            )
            db.add(document)
            db.flush()
            if latest is not None:
                if latest.version_group_id is None:
                    latest.version_group_id = latest.id
                document.version_group_id = latest.version_group_id
            else:
                document.version_group_id = document.id
            db.commit()
            ingestion.enqueue(document.id)
            audit_service.record("document.uploaded", tenant_id=owner.tenant_id, actor_username="watched-folder",
                                 target_type="document", target_id=document.id, target_label=document.filename,
                                 details={"source": "watched folder", "path": relative[:200],
                                          "visibility": document.visibility, "version": document.version})
            return True
        finally:
            db.close()


_watcher: FolderWatcher | None = None


def start_from_config() -> FolderWatcher | None:
    global _watcher
    if not WATCH_FOLDER:
        return None
    root = Path(WATCH_FOLDER)
    if not root.is_dir():
        logger.warning("WATCH_FOLDER does not exist; watched folder is off", extra={"fields": {"folder": WATCH_FOLDER}})
        return None
    _watcher = FolderWatcher(root, WATCH_INTERVAL_SECONDS)
    _watcher.start()
    return _watcher


def status() -> dict:
    if _watcher is None:
        return {"enabled": False}
    return {"enabled": True, "folder": str(_watcher.root), "interval_seconds": _watcher.interval,
            "last_scan": _watcher.last_scan, "last_error": _watcher.last_error,
            "files_tracked": len(_watcher._done)}


def stop() -> None:
    if _watcher is not None:
        _watcher.stop()
