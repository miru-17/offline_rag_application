"""
Loads the RAGENTIS demo for the FICTIONAL company "Velvizhi Engineering Pvt. Ltd.".

Creates demo users and team spaces, uploads the demo documents with the right
sharing, makes a new contract version, places a legal hold, adds the sales
register to the Data Dashboard, starts an invoice extraction, asks sample
questions (so Insights has data) and creates a report.

Needs only Python 3.9+ (no extra packages). RAGENTIS must be running and an
administrator account and licence must exist.

    python demo/seed_demo.py --admin admin
    python demo/seed_demo.py --admin admin --url https://localhost:8443/api
    python demo/seed_demo.py --admin admin --skip-questions      # faster

Safe to run again: existing users, team spaces and documents are reused.
"""

from __future__ import annotations

import argparse
import getpass
import json
import mimetypes
import ssl
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE / "documents"

USERS = [
    # username, email, role, team, full description
    ("hr.priya", "priya.raman@velvizhi.example", "USER", "HR", "Priya Raman - HR Executive"),
    ("fin.arun", "arun.kumar@velvizhi.example", "USER", "Finance", "Arun Kumar - Accounts Manager"),
    ("sales.karthik", "karthik.s@velvizhi.example", "USER", "Sales", "Karthik Subramani - Sales Engineer"),
    ("emp.divya", "divya.n@velvizhi.example", "VIEWER", None, "Divya Natarajan - Production Engineer (read-only)"),
]
TEAMS = {
    "HR": "Human Resources - leave, payroll and employee records",
    "Finance": "Accounts - invoices, payments and financial reports",
    "Sales": "Sales and customer orders",
}
# file, uploaded by ("admin" or a demo user), visibility, team
UPLOADS = [
    ("Travel_and_Expense_Policy.pdf", "admin", "TENANT", None),
    ("IT_Security_Policy.pdf", "admin", "TENANT", None),
    ("Employee_Handbook_2026.docx", "admin", "TENANT", None),
    ("Vendor_Contract_Steelmark_v1.pdf", "admin", "TENANT", None),
    ("HR_Leave_Policy_2026.pdf", "hr.priya", "GROUP", "HR"),
    ("Employee_Master_Confidential.xlsx", "hr.priya", "GROUP", "HR"),
    ("Invoice_INV-2026-0417.pdf", "fin.arun", "GROUP", "Finance"),
    ("Invoice_INV-2026-0452.pdf", "fin.arun", "GROUP", "Finance"),
    ("Invoice_INV-2026-0478.pdf", "fin.arun", "GROUP", "Finance"),
    ("Invoice_INV-2026-0489.pdf", "fin.arun", "GROUP", "Finance"),
    ("Scanned_Invoice_INV-2026-0503.png", "fin.arun", "GROUP", "Finance"),
    ("Q2_FY2026-27_Finance_Summary.docx", "fin.arun", "GROUP", "Finance"),
]
QUESTIONS = [
    ("emp.divya", "How many days of earned leave do we get per year?"),          # not visible to Divya -> gap
    ("emp.divya", "What is the hotel limit for an engineer in a metro city?"),
    ("emp.divya", "Within how many hours must a lost laptop be reported?"),
    ("hr.priya", "How many earned leave days can be carried forward?"),
    ("hr.priya", "What is the notice period for a G5 Senior Engineer?"),
    ("fin.arun", "What is the total amount of invoice INV-2026-0417?"),
    ("fin.arun", "What are the payment terms in the Steelmark supply agreement?"),
    ("sales.karthik", "What is the canteen lunch price?"),                        # not uploaded yet -> gap
    ("sales.karthik", "Who approves international travel?"),
]


class Api:
    def __init__(self, base: str, insecure_local: bool):
        self.base = base.rstrip("/")
        self.ctx = None
        if self.base.startswith("https://") and insecure_local:
            # RAGENTIS's own certificate on this computer (see admin guide section 3).
            self.ctx = ssl.create_default_context()
            self.ctx.check_hostname = False
            self.ctx.verify_mode = ssl.CERT_NONE

    def call(self, method, path, token=None, body=None, form=None, files=None, ok=(200, 201, 202, 204)):
        headers = {}
        data = None
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if files is not None or form is not None:
            boundary = uuid.uuid4().hex
            parts = []
            for key, value in (form or {}).items():
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
            for key, path_ in (files or {}).items():
                mime = mimetypes.guess_type(path_.name)[0] or "application/octet-stream"
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{path_.name}"\r\n'
                             f"Content-Type: {mime}\r\n\r\n".encode() + path_.read_bytes() + b"\r\n")
            parts.append(f"--{boundary}--\r\n".encode())
            data = b"".join(parts)
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        elif body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, context=self.ctx, timeout=600) as response:
                raw = response.read()
                status = response.status
        except urllib.error.HTTPError as exc:
            raw, status = exc.read(), exc.code
        except urllib.error.URLError as exc:
            sys.exit(f"Cannot reach RAGENTIS at {self.base}: {exc.reason}. Is it running (docker compose ps)?")
        try:
            payload = json.loads(raw) if raw else {}
        except ValueError:
            payload = {"raw": raw[:200].decode(errors="replace")}
        if status not in ok:
            raise ApiError(status, payload)
        return payload


class ApiError(Exception):
    def __init__(self, status, payload):
        super().__init__(f"{status}: {payload.get('detail', payload) if isinstance(payload, dict) else payload}")
        self.status, self.payload = status, payload


def step(text):
    print(f"\n== {text}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Load the Velvizhi Engineering demo into RAGENTIS.")
    parser.add_argument("--url", default="https://localhost:8443/api")
    parser.add_argument("--admin", required=True, help="existing administrator user name")
    parser.add_argument("--password", help="administrator password (asked if omitted)")
    parser.add_argument("--demo-password", default="Velvizhi@2026", help="password for the demo users")
    parser.add_argument("--skip-questions", action="store_true", help="do not ask the sample questions")
    parser.add_argument("--strict-tls", action="store_true", help="verify the HTTPS certificate")
    args = parser.parse_args()
    password = args.password or getpass.getpass(f"Password for {args.admin}: ")

    api = Api(args.url, insecure_local=not args.strict_tls)

    def login(user, pw):
        result = api.call("POST", "/auth/login", body={"username": user, "password": pw})
        if result.get("mfa_required"):
            sys.exit(f"{user} has two-step login switched on; switch it off for the seeding run.")
        if result.get("must_change_password"):
            sys.exit(f"{user} must change the password first (sign in once in the browser).")
        return result["access_token"]

    step("Signing in")
    try:
        admin = login(args.admin, password)
    except ApiError as exc:
        sys.exit(f"Administrator sign-in failed ({exc}).")
    me = api.call("GET", "/auth/me", admin)
    if me.get("role") != "ADMIN":
        sys.exit(f"{args.admin} is not an administrator.")
    licence = api.call("GET", "/license/status", admin)
    if not licence.get("licensed"):
        sys.exit("No valid licence is installed. Install it on the Licence page first.")
    print(f"   signed in as {args.admin}; licence: {licence['state']}")

    step("Organisation settings")
    api.call("PATCH", "/rag-settings/", admin, body={"organisation_name": "Velvizhi Engineering Pvt. Ltd.",
                                                     "pii_mode": "redact", "hybrid_search": True,
                                                     "source_attribution": True})
    print("   organisation name: Velvizhi Engineering Pvt. Ltd.")
    print("   personal data (PAN, phone, e-mail, IFSC) is hidden from the AI; exact-match search on")

    step("Demo users")
    existing = {u["username"]: u for u in api.call("GET", "/users/", admin)}
    ids = {args.admin: me["id"]}
    for username, email, role, _team, label in USERS:
        if username in existing:
            ids[username] = existing[username]["id"]
            print(f"   {username:15} already exists")
            continue
        try:
            created = api.call("POST", "/users/", admin, body={"username": username, "email": email,
                                                               "password": args.demo_password, "role": role})
        except ApiError as exc:
            sys.exit(f"Could not create {username}: {exc} (licence user limit?)")
        ids[username] = created["id"]
        print(f"   {username:15} created ({label})")

    step("Team spaces")
    groups = {g["name"]: g for g in api.call("GET", "/groups/", admin)}
    group_ids = {}
    for name, description in TEAMS.items():
        group = groups.get(name) or api.call("POST", "/groups/", admin, body={"name": name, "description": description})
        group_ids[name] = group["id"]
        members = {m["id"] for m in group.get("members", [])}
        wanted = [ids[u] for u, *_ in USERS if _[2] == name] + [ids[args.admin]]
        for user_id in wanted:
            if user_id not in members:
                api.call("POST", f"/groups/{group['id']}/members", admin, body={"user_id": user_id})
        print(f"   {name:8} ready")

    tokens = {args.admin: admin}
    for username, *_ in USERS:
        tokens[username] = login(username, args.demo_password)

    step("Uploading documents")
    def find_document(token, filename):
        for doc in api.call("GET", "/documents/?include_history=true", token):
            if doc["filename"] == filename:
                return doc
        return None

    uploaded = {}
    for filename, owner, visibility, team in UPLOADS:
        token = tokens[args.admin if owner == "admin" else owner]
        form = {"visibility": visibility}
        if team:
            form["group_id"] = group_ids[team]
        try:
            doc = api.call("POST", "/documents/upload", token, form=form, files={"file": DOCS / filename})
            print(f"   {filename:40} uploaded ({visibility.lower()}{' ' + team if team else ''})")
        except ApiError as exc:
            if exc.status != 409:
                sys.exit(f"Upload of {filename} failed: {exc}")
            doc = find_document(token, filename)
            print(f"   {filename:40} already there")
        uploaded[filename] = (doc, token)

    def wait_ready(doc, token, label):
        for _ in range(900):
            current = api.call("GET", f"/documents/{doc['id']}", token)
            if current["status"] in ("ready", "failed", "superseded"):
                return current
            time.sleep(1)
        print(f"   {label}: still processing - continue, it will finish in the background")
        return current

    print("   waiting for indexing (OCR of the scanned invoice can take a minute)...")
    for filename, (doc, token) in uploaded.items():
        state = wait_ready(doc, token, filename)
        if state["status"] == "failed":
            print(f"   ! {filename} failed: {state.get('error_message')}")

    step("Contract version 2 and legal hold")
    v1, _ = uploaded["Vendor_Contract_Steelmark_v1.pdf"]
    v2 = find_document(admin, "Vendor_Contract_Steelmark_v2.pdf")
    if v2 is None:
        current = api.call("GET", f"/documents/{v1['id']}", admin)
        if current["status"] == "ready":
            v2 = api.call("POST", "/documents/upload", admin, form={"replace_document_id": v1["id"]},
                          files={"file": DOCS / "Vendor_Contract_Steelmark_v2.pdf"})
            v2 = wait_ready(v2, admin, "contract v2")
            print("   version 2 uploaded; version 1 kept in history")
    if v2 is not None:
        api.call("PATCH", f"/documents/{v2['id']}/legal-hold?hold=true", admin)
        print("   legal hold placed on the supply agreement")

    step("Data Dashboard")
    datasets = {d["name"]: d for d in api.call("GET", "/datasets/", admin)}
    if "Sales_Register_FY2026-27.xlsx" not in datasets:
        sales = api.call("POST", "/datasets/upload", admin, form={"shared": "true"},
                         files={"file": DOCS / "Sales_Register_FY2026-27.xlsx"})
        print(f"   sales register: {sales.get('row_count', '?')} rows, shared with everyone")
    else:
        print("   sales register already there")

    step("Invoice extraction (runs in the background)")
    arun = tokens["fin.arun"]
    jobs = api.call("GET", "/extraction/jobs", arun)
    if not any(j["name"] == "Vendor invoices Sep-Oct 2026" for j in jobs):
        invoice_ids = [uploaded[f][0]["id"] for f, *_ in UPLOADS if f.startswith(("Invoice_", "Scanned_Invoice"))]
        api.call("POST", "/extraction/jobs", arun, body={
            "name": "Vendor invoices Sep-Oct 2026",
            "document_ids": invoice_ids,
            "fields": [{"name": "Invoice Number"}, {"name": "Invoice Date"}, {"name": "Vendor"},
                       {"name": "Total Amount", "description": "grand total including GST, in rupees"},
                       {"name": "Supplier GSTIN"}],
        })
        print("   started: 5 invoices x 5 fields (see Extraction page as fin.arun)")
    else:
        print("   extraction already there")

    if not args.skip_questions:
        step("Sample questions (fills Insights; each answer takes a few seconds on a laptop)")
        for username, question in QUESTIONS:
            try:
                result = api.call("POST", "/query/", tokens[username], body={"query": question})
            except ApiError as exc:
                print(f"   {username}: {exc}")
                continue
            status = result.get("status")
            print(f"   {username:14} {question[:58]:58} -> {status}")
            message_id = result.get("message_id")
            if message_id and status == "answered":
                api.call("POST", f"/conversations/messages/{message_id}/feedback", tokens[username],
                         body={"rating": "up"})

    step("Usage report")
    api.call("POST", "/reports/generate?days=30", admin)
    print("   report created (Reports page)")

    print("\nDemo ready. Sign in as:")
    print(f"   {args.admin:15} (your administrator)")
    for username, _email, role, team, label in USERS:
        print(f"   {username:15} password {args.demo_password}   {role:6} {team or '-':8} {label}")
    print("\nFor the watched-folder demo copy demo\\watch-sample\\Canteen_Menu_November_2026.pdf into the watch folder.")
    print("Script for the video: docs/DEMO_SCRIPT.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
