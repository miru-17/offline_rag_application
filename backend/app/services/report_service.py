"""
Usage reports as PDF: weekly (automatic) or on request.

Contents: questions asked, answer rate, feedback, active users, documents
added, failed sign-ins, licence status and the top unanswered questions
(knowledge gaps, without who asked). No answers or document text.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import func, select

from app.core.config import REPORTS_DIR
from app.core.logging import get_logger
from app.database.connection import SessionLocal
from app.models.audit_event import AuditEvent
from app.models.document import Document
from app.models.report import Report
from app.models.tenant import Tenant
from app.models.user import User
from app.services import audit_service
from app.services.license_service import LicenseService

logger = get_logger("reports")

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]
CHECK_EVERY_SECONDS = 3600


def collect(db, tenant_id, start: datetime, end: datetime) -> dict:
    # Re-use the same numbers as the Insights page.
    from app.routers.insights import knowledge_gaps, overview

    days = max(1, round((end - start).total_seconds() / 86400))
    viewer = SimpleNamespace(tenant_id=tenant_id)
    usage = overview(days=days, current_user=viewer, db=db)
    gaps = knowledge_gaps(days=days, limit=10, current_user=viewer, db=db)

    documents_added = db.execute(
        select(Document.file_type, func.count()).where(Document.tenant_id == tenant_id,
                                                       Document.created_at >= start, Document.created_at < end)
        .group_by(Document.file_type)
    ).all()
    documents_total = db.scalar(select(func.count(Document.id)).where(Document.tenant_id == tenant_id,
                                                                      Document.status == "ready"))
    failed_logins = db.scalar(select(func.count(AuditEvent.id)).where(
        AuditEvent.tenant_id == tenant_id, AuditEvent.action.in_(["auth.login", "auth.mfa"]),
        AuditEvent.outcome == "failure", AuditEvent.created_at >= start))
    users_total = db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant_id, User.is_active.is_(True)))
    licence = LicenseService.evaluate(db, tenant_id, record_time=False)
    return {
        "usage": usage,
        "gaps": gaps,
        "documents_added": {t: c for t, c in documents_added},
        "documents_total": documents_total or 0,
        "failed_logins": failed_logins or 0,
        "users_total": users_total or 0,
        "licence": {"state": licence.state, "days_left": licence.days_left, "message": licence.message,
                    "warning": (licence.warning or {}).get("message")},
    }


class _Pdf:
    def __init__(self):
        from fpdf import FPDF

        self.pdf = FPDF(format="A4")
        self.pdf.set_auto_page_break(True, margin=15)
        self.pdf.add_page()
        self.unicode = False
        for path in FONT_CANDIDATES:
            if Path(path).exists():
                self.pdf.add_font("Body", "", path)
                bold = path.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")
                self.pdf.add_font("Body", "B", bold if Path(bold).exists() else path)
                self.unicode = True
                break
        self.family = "Body" if self.unicode else "Helvetica"

    def text(self, value) -> str:
        value = str(value)
        return value if self.unicode else value.encode("latin-1", "replace").decode("latin-1")

    def heading(self, value, size=16):
        self.pdf.set_font(self.family, "B", size)
        self.pdf.multi_cell(0, 9, self.text(value), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(1)

    def line(self, value, size=10, bold=False):
        self.pdf.set_font(self.family, "B" if bold else "", size)
        self.pdf.multi_cell(0, 6, self.text(value), new_x="LMARGIN", new_y="NEXT")

    def kv(self, rows: list[tuple[str, object]]):
        self.pdf.set_font(self.family, "", 10)
        for label, value in rows:
            self.pdf.cell(70, 7, self.text(label), border="B")
            self.pdf.cell(0, 7, self.text(value), border="B", new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(3)


def render_pdf(tenant_name: str, start: datetime, end: datetime, data: dict, path: Path) -> None:
    usage, answers = data["usage"], data["usage"]["answers"]
    doc = _Pdf()
    doc.heading("RAGENTIS usage report", 18)
    doc.line(f"{tenant_name}  |  {start:%d %b %Y} – {end:%d %b %Y}")
    doc.line(f"Generated {datetime.utcnow():%d %b %Y %H:%M} UTC", 8)
    doc.pdf.ln(4)

    doc.heading("Use", 13)
    rate = answers.get("answer_rate")
    doc.kv([
        ("Questions asked", usage["questions"]),
        ("Active users", f"{usage['active_users']} of {data['users_total']}"),
        ("Answered from documents", f"{answers['answered']} ({round(rate * 100)}%)" if rate is not None else "–"),
        ("Not in the documents", answers["not_found"]),
        ("Feedback", f"{usage['feedback']['up']} helpful / {usage['feedback']['down']} not helpful"),
    ])

    doc.heading("Documents", 13)
    added = data["documents_added"]
    doc.kv([
        ("Added in this period", sum(added.values())),
        ("By type", ", ".join(f"{k.upper()} {v}" for k, v in sorted(added.items())) or "–"),
        ("Ready to answer questions (total)", data["documents_total"]),
    ])

    doc.heading("Security and licence", 13)
    licence = data["licence"]
    doc.kv([
        ("Failed sign-ins", data["failed_logins"]),
        ("Licence", f"{licence['state']} – {licence['days_left']} days left" if licence["days_left"] is not None
         else licence["state"]),
    ])

    if licence.get("warning"):
        doc.line("Action needed: " + licence["warning"], 10, bold=True)
        doc.pdf.ln(2)

    doc.heading("Knowledge gaps", 13)
    doc.line("Questions the documents could not answer (who asked is not recorded here). "
             "Adding documents on these topics improves answers.", 9)
    doc.pdf.ln(2)
    questions = data["gaps"].get("questions") or []
    if not questions:
        doc.line("None in this period.")
    for entry in questions:
        doc.line(f"• {entry['question'][:200]}  ({entry['count']}×)")
    topics = data["gaps"].get("missing_topics") or []
    if topics:
        doc.pdf.ln(2)
        doc.line("Frequent topics: " + ", ".join(t["topic"] for t in topics[:10]), 9)

    path.parent.mkdir(parents=True, exist_ok=True)
    doc.pdf.output(str(path))


def generate(db, tenant: Tenant, days: int = 7, kind: str = "manual", created_by=None) -> Report:
    end = datetime.utcnow().replace(microsecond=0)
    start = end - timedelta(days=days)
    data = collect(db, tenant.id, start, end)
    path = Path(REPORTS_DIR) / str(tenant.id) / f"{end:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}.pdf"
    render_pdf(tenant.name, start, end, data, path)
    report = Report(tenant_id=tenant.id, created_by=created_by, kind=kind, period_start=start, period_end=end,
                    file_path=str(path), file_size=path.stat().st_size)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def run_due() -> int:
    """Create the weekly report for every organisation whose last one is 7+ days old."""
    db = SessionLocal()
    created = 0
    try:
        for tenant in db.scalars(select(Tenant).where(Tenant.report_schedule == "weekly")).all():
            if not db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id)):
                continue
            last = db.scalar(select(func.max(Report.created_at)).where(Report.tenant_id == tenant.id,
                                                                     Report.kind == "weekly"))
            if last is not None and datetime.utcnow() - last < timedelta(days=7):
                continue
            try:
                report = generate(db, tenant, 7, "weekly")
                audit_service.record("report.generated", tenant_id=tenant.id, actor_username="system",
                                     target_type="report", target_id=report.id, details={"kind": "weekly"})
                created += 1
            except Exception:
                db.rollback()
                logger.exception("Weekly report failed", extra={"fields": {"tenant_id": str(tenant.id)}})
    finally:
        db.close()
    return created


_stop = threading.Event()


def _loop() -> None:
    if _stop.wait(120):
        return
    while not _stop.is_set():
        try:
            run_due()
        except Exception:
            logger.exception("Report scheduler failed")
        if _stop.wait(CHECK_EVERY_SECONDS):
            return


def start() -> None:
    threading.Thread(target=_loop, name="ragentis-reports", daemon=True).start()


def stop() -> None:
    _stop.set()
