# RAGENTIS 3 – what is new and how to start it

Your database, Docker volumes, uploaded files and `.env` are kept. The database
is upgraded automatically on start (migration `c8d2e4f6a1b3`, adds only).

## New

| Area | Feature |
| --- | --- |
| Sign-in | Sessions stay signed in for 14 days (rotating refresh tokens, theft detection); admin **password reset** with forced change; **two-step login** (authenticator app); **Active Directory / LDAP** sign-in with roles from AD groups |
| Documents | **OCR** for scanned PDFs and photos (PNG/JPG); **open the original PDF at the cited page**; **versions** (answers use the newest); **legal hold**; **watched folder** (`./watch`, team-space sub-folders) |
| Answers | **Hybrid search** (exact invoice numbers / IDs + meaning); answer language (same as question or fixed); multilingual embedding option + re-index; **AI model per organisation** |
| Data | Word / Excel **tables → Data Dashboard** |
| Governance | **Data retention** for chats, audit log, documents (legal hold wins); weekly **PDF reports** |
| Integration | **API keys** + REST API (`docs/API.md`) |
| Vendor | Licence registry: `license_issuer.py list --expiring 30`, `renew`, `export` |
| Deployment | **HTTPS web container** (app + API on https://localhost:8443); **offline installer** (`scripts/package-offline.sh` → `install.cmd` / `install.sh`); backup/restore incl. reports, Windows `.cmd` versions |
| Docs | `ADMIN_GUIDE.md`, `USER_GUIDE.md`, `API.md`, `EULA_TEMPLATE.md` (lawyer review needed) |

## Start on your laptop

> Do **not** run `docker compose down -v`.

1. Optional but recommended – add to `.env` (keep your existing values):
   ```
   DATA_ENCRYPTION_KEY=<python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
   ```
2. Build and start (first build downloads Tesseract and Caddy, a few minutes):
   ```
   docker compose up -d --build
   docker compose ps          # postgres, ollama, backend, web = running
   ```
3. Open **https://localhost:8443** → the browser warns about the certificate the
   first time → *Advanced → Continue*. (To remove the warning see ADMIN_GUIDE §3.)
4. The developer front end still works: `cd frontend && npm install && npm run dev`
   → http://localhost:5173.
5. Licence: the new licence feature **`api`** controls API keys. A licence issued
   with `--features "*"` already includes it.

## Tests run

| Suite | Result |
| --- | --- |
| Earlier API suite (2.0 features) | 143 / 143 |
| New API suite (sessions, reset, MFA, LDAP, OCR, file viewer, versions, legal hold, tables, watched folder, hybrid search, language, model, retention, re-index, API keys, reports, vendor console) | 166 / 166 |
| HTTPS web server (Caddy): streaming, Stop, upload limits, PDF download | 8 / 8 |
| Browser walk-through through HTTPS (all new screens, no JS or CSP errors) | 41 / 41 |
| Backup → damage → restore round trip (scripts with a Docker stand-in) | 15 / 15 |
| Upgrade of a 2.0 database with data; `alembic check`; downgrade/upgrade | passed |

Not tested here (no Docker in the test machine): building the images, the
offline package/installer end to end, Windows `.cmd`/PowerShell scripts.
Test these on your laptop – see the checklist in the chat.
