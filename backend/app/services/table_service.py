"""
Tables inside Word and Excel documents -> datasets for the Data Dashboard.

Word: every table, first row used as the header.
Excel: every sheet (pandas reads it; the first non-empty row is the header).
"""

from __future__ import annotations

import csv
import uuid
from pathlib import Path

import pandas as pd
from docx import Document as DocxDocument

from app.core.config import UPLOAD_ROOT
from app.services.analytics_service import AnalyticsError

MAX_TABLES = 50


def _docx_tables(path: str) -> list[dict]:
    document = DocxDocument(path)
    tables = []
    for index, table in enumerate(document.tables[:MAX_TABLES]):
        rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
        rows = [r for r in rows if any(r)]
        if len(rows) < 2:
            continue
        header = [h or f"Column {i + 1}" for i, h in enumerate(rows[0])]
        tables.append({"index": index, "name": f"Table {index + 1}", "header": header, "rows": rows[1:]})
    return tables


def _xlsx_tables(path: str) -> list[dict]:
    sheets = pd.read_excel(path, sheet_name=None, dtype=object, nrows=200_000, engine="openpyxl")
    tables = []
    for index, (name, frame) in enumerate(list(sheets.items())[:MAX_TABLES]):
        frame = frame.dropna(how="all").dropna(axis=1, how="all")
        if frame.empty:
            continue
        header = [str(c) if not str(c).startswith("Unnamed:") else f"Column {i + 1}" for i, c in enumerate(frame.columns)]
        rows = [["" if pd.isna(v) else (v.isoformat() if hasattr(v, "isoformat") else str(v)) for v in row]
                for row in frame.itertuples(index=False)]
        tables.append({"index": index, "name": f"Sheet {name}", "header": header, "rows": rows})
    return tables


def list_tables(path: str, file_type: str) -> list[dict]:
    try:
        if file_type == "docx":
            return _docx_tables(path)
        if file_type == "xlsx":
            return _xlsx_tables(path)
    except Exception:
        raise AnalyticsError("The tables in this document could not be read.")
    raise AnalyticsError("Only Word (.docx) and Excel (.xlsx) documents contain tables that can be imported.")


def summarise(tables: list[dict]) -> list[dict]:
    return [
        {"index": t["index"], "name": t["name"], "columns": t["header"], "row_count": len(t["rows"]),
         "preview": t["rows"][:5]}
        for t in tables
    ]


def write_csv(owner_id, table: dict) -> str:
    directory = UPLOAD_ROOT / "datasets" / str(owner_id)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid.uuid4()}.csv"
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(table["header"])
        width = len(table["header"])
        for row in table["rows"]:
            writer.writerow((list(row) + [""] * width)[:width])
    return str(Path(path))
