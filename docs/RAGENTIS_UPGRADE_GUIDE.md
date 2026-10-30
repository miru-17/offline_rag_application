# RAGENTIS 2.0 – what changed and how to start it

Branch: `feature/ragentis-commercial` (4 commits on top of `70c463a`).
Your database, Docker volumes and uploaded files are kept. Nothing is deleted.

---

## 1. What is new

| Area | What you get |
| --- | --- |
| Security | Server refuses to start without a strong `JWT_SECRET_KEY`; PostgreSQL, Ollama and the API listen only on your own computer; debug endpoints removed; uploads checked by real content (a renamed `.exe` is rejected); rate limits on login, questions and uploads; account deactivation; old logins stop working after a password change; container runs as a non-root user; vulnerable packages replaced or upgraded |
| Uploads | Processed in the background (chat keeps working); status Queued → Processing → Ready / Failed with a readable reason and a Retry button; duplicate files detected; one shared embedding model instead of one per upload |
| Answers | Stream word by word with a **Stop** button; every answer shows **evidence** (file, page or sheet, % match, the exact passage) and keeps it when the chat is reopened; 👍 / 👎 feedback; short follow-ups ("explain that more") understand the previous question; documents can no longer inject instructions into the AI |
| Licence | Signed offline licence (Ed25519). Editing the database or the file breaks the signature. Expiry, grace period, user limit and feature list come from the signed file. Clock roll-back is detected |
| Audit log | Logins (success and failure), users, roles, uploads, deletions, licence, settings, team spaces, exports. Never stores questions, answers or document text. Filter + CSV export |
| Data Dashboard | Upload CSV / Excel → column types detected (₹, commas, dd/mm/yyyy handled) → KPI tiles, monthly timeline, bar charts, preview → **Ask the data** in plain English → export CSV (protected against formula injection). Totals are exact over all rows |
| Structured extraction | Pick documents + fields (templates for invoices, contracts, resumes, POs) → table → opens in the Data Dashboard |
| Compare / summary | What changed between two versions (exact text + AI summary); one-click document summary |
| PII protection | Aadhaar (checksum), PAN, phone, email, IFSC, card (checksum). Settings → Off / Flag / Redact. Redact hides values from the AI completely |
| Team spaces | HR, Finance, … Documents uploaded to a space are answered only for its members |
| Insights | Questions per day, answer rate, feedback, **knowledge gaps** (questions the system could not answer – who asked is not shown), system health |
| Operations | `scripts/backup.sh`, `scripts/restore.sh`, `scripts/evaluate.py` |

---

## 2. One-time steps (your laptop, Windows 11 + WSL2)

> Do **not** run `docker compose down -v` at any point. It deletes your data.

### 2.1 Get the code

```bash
cd offline_rag_application
git checkout -b feature/ragentis-commercial
git am /path/to/patches/000*.patch        # the four .patch files
git rm -r --cached backend/chroma_db      # stop tracking the vector database (your files stay on disk)
git commit -m "Stop tracking backend/chroma_db"
```

### 2.2 Make the GitHub repository private

GitHub → repository → Settings → General → Danger Zone → Change visibility → Private.
The old commits still contain `backend/chroma_db` (document text). Removing it from history
needs a force-push and is **not done** until you approve it.

### 2.3 Secrets in `.env` (next to `docker-compose.yml`)

```
POSTGRES_PASSWORD=<keep your CURRENT password – the existing database uses it>
JWT_SECRET_KEY=<new value, at least 32 characters>
```

Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
Changing `JWT_SECRET_KEY` logs everyone out once; that is expected.

### 2.4 Licence keys (vendor side, once)

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # (Linux: source .venv/bin/activate)
pip install cryptography==50.0.0
python tools/license_issuer.py init-keys
```

* `~/.ragentis/license_signing_key.pem` – **private key. Keep secret, back it up, never commit.**
* `backend/app/core/license_public_key.pem` – public key, ships with the product (commit it).

Issue a licence for yourself / a customer:

```bash
python tools/license_issuer.py issue --customer "Demo Company" --days 365 --max-users 25 --out demo.license
# limit features:  --features "chat,documents,analytics"
```

### 2.5 Start

```bash
docker compose up -d --build        # bootstrap migrates the existing database automatically
docker exec ragentis-ollama ollama pull llama3.2:3b   # only if not pulled before
cd frontend && npm install && npm run dev            # http://localhost:5173
```

### 2.6 First login after the upgrade

1. Sign in with your existing admin account.
2. **Licence** page → *Install licence* → choose `demo.license`.
   (The old unsigned licence is no longer accepted – that is the point of the change.)
3. **Settings** → choose the PII mode.
4. Old documents keep working. Re-upload them if you want page numbers in the evidence panel.

New installation (empty database): the first account you create becomes the ADMIN.
After that, public sign-up is off; add people from **Users** (or set `ALLOW_SELF_REGISTRATION=true`).

---

## 3. How it was tested

| Test | Result |
| --- | --- |
| API end-to-end suite (`harness2/api_test.py`): auth, licence tampering, uploads, isolation, injection, streaming + Stop, PII, team spaces, compare, dashboard maths, extraction, audit, rate limits, account lifecycle | **143 / 143 passed** |
| Browser walk-through (Playwright): first-run admin, licence install, upload, streaming chat, evidence, Stop, dashboard, all new pages, no JavaScript errors | **19 / 19 passed** |
| Upgrade of an old-version database with data | users and documents kept; `alembic check`: schema matches models |
| `pip-audit` | only `chromadb` remains (no fixed version exists; the advisories affect Chroma's HTTP server mode, which RAGENTIS does not run – it uses the embedded library) |
| `npm audit` | 0 vulnerabilities |

**Limits of these tests:** the real models (llama3.2:3b, all-MiniLM-L6-v2) could not be
downloaded in the test environment, so stand-ins were used. Answer quality, speed and RAM
on your i5-1335U are **not measured yet** – run `scripts/evaluate.py` and `docker stats` on
your laptop for real numbers.

---

## 4. Not built yet (and why)

| Feature | Reason |
| --- | --- |
| OCR for scanned PDFs | Needs Tesseract in the image (+~150 MB) and is slow on CPU – next step |
| Encryption at rest | Key management decision needed (Windows BitLocker covers the laptop today) |
| Signed offline update packages, SSO/LDAP, hybrid keyword search, scheduled reports, watched folder, multilingual | Planned after the first pilot, as in the roadmap |
| Git history purge | Waiting for your approval (force-push) |
