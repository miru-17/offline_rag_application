# RAGENTIS – Administrator guide

For the IT person who installs and runs RAGENTIS at a customer site.
RAGENTIS runs completely offline on one computer (Windows 11 with Docker
Desktop, or Ubuntu 22.04+ with Docker). Documents never leave that computer.

---

## 1. Requirements

| | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 cores | 8 cores |
| RAM | 16 GB | 32 GB |
| Disk | 50 GB SSD free | 100 GB SSD |
| GPU | – | NVIDIA 8 GB (much faster answers) |
| Software | Docker Desktop (Windows) or Docker Engine + compose plugin (Linux) | |

Docker Desktop on Windows: Settings → Resources → give Docker at least 8 GB RAM.

---

## 2. Install

### 2.1 From the offline package (no internet on the customer computer)

1. Copy `ragentis-offline-<date>.tar.gz` and its `.sha256` file to the computer.
2. Unpack it (Windows: 7-Zip; Linux: `tar xzf ragentis-offline-<date>.tar.gz`).
3. Start Docker Desktop.
4. Run **`install.cmd`** (Windows, double-click) or **`sh install.sh`** (Linux).

The installer checks the package, loads the images, creates `.env` with new
random secrets, copies the AI models, starts everything and prints the address,
normally **https://localhost:8443**.

5. Open the address. The first account you create becomes the **administrator**.
6. **Licence** page → *Install licence* → choose the `.license` file you received.

> **Back up `.env` now** (USB drive in a safe, or the company password vault).
> It holds the database password and the keys that protect sign-ins. A backup of
> the data is useless without it.

Running the installer again is safe: existing data and the existing `.env` are kept.

### 2.2 From source (vendor / developer)

```bash
cp .env.example .env        # fill in POSTGRES_PASSWORD, JWT_SECRET_KEY, DATA_ENCRYPTION_KEY
docker compose up -d --build
docker exec ragentis-ollama ollama pull llama3.2:3b
```

---

## 3. HTTPS and access from other computers

RAGENTIS serves the app and the API over HTTPS on port **8443** (HTTP on 8080
only redirects to HTTPS).

**Only this computer (default):** `RAGENTIS_BIND=127.0.0.1`.

**Whole office network:** in `.env`

```
RAGENTIS_BIND=0.0.0.0
RAGENTIS_HOSTS=localhost 127.0.0.1 192.168.1.20 ragentis.corp.local
```

(use this computer's real IP address and/or DNS name), then `docker compose up -d`.
Allow TCP 8443 in Windows Defender Firewall for the private network only.

**Certificate.** Two choices:

* *Built-in (default, `RAGENTIS_TLS=internal`).* RAGENTIS creates its own small
  certificate authority. Browsers warn until its root certificate is trusted.
  Export it once:

  ```
  docker cp ragentis-web:/data/caddy/pki/authorities/local/root.crt ragentis-root.crt
  ```

  Install `ragentis-root.crt` on each office PC as a *Trusted Root Certification
  Authority* (Windows: double-click → Install Certificate → Local Machine →
  Trusted Root Certification Authorities), or push it with Group Policy.
* *Company certificate.* Copy `cert.pem` (full chain) and `key.pem` into the
  `certs` folder and set `RAGENTIS_TLS=/certs/cert.pem /certs/key.pem`.

---

## 4. Users and sign-in

* **Users & roles** page: add people, change roles, deactivate.
  * **ADMIN** – everything, including users, licence, settings and the audit log.
  * **USER** – upload documents, ask questions, data dashboard, extraction.
  * **VIEWER** – ask questions and read; cannot upload.
* **Forgotten password:** Users → ⋮ → *Reset password*. A one-time temporary
  password is shown once; the user must choose a new password at the next
  sign-in. All their open sessions end.
* **Two-step login (MFA):** each user switches it on in **Settings**
  (Google Authenticator, Microsoft Authenticator, …). Lost phone: Users → ⋮ →
  *Turn off two-step login*.
* **Sessions:** a sign-in stays valid for 14 days of use (`REFRESH_TOKEN_DAYS`).
  Changing a password, resetting it or deactivating an account ends all sessions.

### 4.1 Active Directory / LDAP

In `.env`, for example:

```
LDAP_ENABLED=true
LDAP_SERVER_URL=ldaps://dc01.corp.local:636
LDAP_BIND_TEMPLATE={username}@corp.local
LDAP_SEARCH_BASE=DC=corp,DC=local
LDAP_USER_FILTER=(sAMAccountName={username})
LDAP_GROUP_ROLE_MAP=CN=RAG-Admins,OU=Groups,DC=corp,DC=local=ADMIN;CN=RAG-Users,OU=Groups,DC=corp,DC=local=USER
LDAP_DEFAULT_ROLE=VIEWER
```

`docker compose up -d` to apply. People sign in with their Windows user name
and password; the account is created at first sign-in and the role follows
their AD group at every sign-in. Local accounts (for example the first
administrator) keep working. Use `ldaps://` so passwords are encrypted on the
network. Directory users change their password in Windows, not in RAGENTIS.

---

## 5. Documents

* Upload PDF, Word, Excel and images (PNG, JPG) up to 25 MB.
* **Scanned PDFs and photos** are read with OCR automatically. For Tamil or
  Hindi text set `OCR_LANGUAGES=eng+tam` or `eng+tam+hin`.
* **Watched folder:** files copied into the `watch` folder (next to
  `docker-compose.yml`, or `RAGENTIS_WATCH_DIR`) are added within a minute and
  shared with the whole organisation. A sub-folder with the exact name of a team
  space (for example `watch/HR/`) shares the file with that team only. When a
  file changes, the new content becomes a new version. RAGENTIS never changes or
  deletes anything in the watched folder. Files belong to `WATCH_OWNER` (a user
  name) or the first administrator.
* **Versions:** in a document's details, *Upload new version*. Answers use only
  the newest version; older ones stay in the history.
* **Legal hold** (admins, in a document's details): the document and all its
  versions cannot be deleted, also not by retention.

---

## 6. Settings that affect everyone (Settings page, admins)

| Setting | What it does |
| --- | --- |
| Retrieval depth | How many passages the AI reads per question (3–10) |
| Show sources | Evidence under every answer |
| Personal data (PII) | Off / flag / redact Aadhaar, PAN, phone, e-mail, IFSC, card numbers |
| Exact-match (hybrid) search | Finds invoice numbers, IDs and quoted phrases word for word |
| Answer language | Same as the question, or a fixed language |
| AI model | Choose among `OLLAMA_ALLOWED_MODELS` (each must be pulled first: `docker exec ragentis-ollama ollama pull qwen2.5:3b`) |
| Data retention | Delete old chats / audit entries / documents automatically (empty = keep forever) |

**Documents in other languages:** set
`EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2` in `.env`,
`docker compose up -d`, then Settings → **Re-index documents** once.

---

## 7. Reports, audit log, insights

* **Reports:** a PDF summary (questions, answer rate, feedback, documents,
  failed sign-ins, licence, top unanswered questions) is created every week
  automatically, or on request. Download from the **Reports** page.
* **Audit log:** every sign-in, upload, deletion, role, licence, setting,
  API key and retention run. Questions, answers and document text are never
  stored in it. Export as CSV.
* **Insights:** usage per day, answer rate, knowledge gaps, system health
  (database, AI engine, queue, disk, watched folder, OCR).

---

## 8. Licence

* **Install / renew:** Licence page → *Install new licence* → choose the `.license`
  file. The vendor sets expiry, users and features; they cannot be edited here.
* **Reminders:** administrators see a banner 30, 15 and 7 days before expiry,
  and the weekly report says "Action needed".
* **After expiry** (and the grace period, normally 7 days) RAGENTIS becomes
  **read-only**: documents, chats, dashboards, reports and the audit log can
  still be opened and exported; uploads, questions and new work pause until the
  renewed licence is installed. Nothing is deleted.
* **Licence for this installation only:** Licence page → *This installation* →
  copy the **activation request** (`RGX-REQ-…`) and send it to the vendor. The
  licence you receive works only on this installation. A backup restored on a
  replacement server keeps the same installation ID and keeps working.
* **History:** every licence installation (also refused ones, with the reason)
  is listed on the Licence page.

### Vendor side (never on a customer computer)

```
python tools/license_issuer.py issue --activation-request RGX-REQ-... --days 365 --out customer.license
python tools/license_issuer.py list --expiring 30
python tools/license_issuer.py renew --license-id LIC-... --days 365 --out renewed.license
python tools/license_issuer.py protect-key          # encrypt an older signing key with a passphrase
python tools/license_issuer.py init-keys --name 2027 # new signing key for rotation
```

The signing key is encrypted with a passphrase (`RAGENTIS_SIGNING_PASSPHRASE`
or asked). Keep the key file and the passphrase in two separate safe places.
To retire a key, delete its public key from `app/core/license_keys/` and ship
an update; re-issue licences with the new key first.

---

## 9. Backup and restore

**Backup** (while running; read-only):

```
scripts\backup.cmd            (Windows)
sh scripts/backup.sh          (Linux / WSL)
```

Creates `backups/<date-time>/` with the database, uploaded files, search index,
reports and a checksum file. Copy it to an encrypted external drive. Keep `.env`
separately. Suggested: daily with Windows Task Scheduler, keep 14 days.

**Restore** (replaces ALL current data – make a fresh backup first):

```
scripts\restore.cmd backups\20261031-180000 --yes-replace-current-data
sh scripts/restore.sh backups/20261031-180000 --yes-replace-current-data
```

**Test the restore every quarter** on a spare computer: install from the offline
package, copy `.env` and the backup folder, run restore, sign in and ask a
question.

> Never run `docker compose down -v`. The `-v` deletes all data volumes.

---

## 10. Updates

1. Make a backup (section 9).
2. Unpack the new package next to the old one, copy your `.env` into it, run the
   installer. Or from source: `git pull` then `docker compose up -d --build`.
3. Database changes are applied automatically at start. Data and `.env` are kept.

---

## 11. Troubleshooting

| Problem | Check |
| --- | --- |
| Page does not open | `docker compose ps` – all four services `running`? `docker compose logs web` |
| "AI engine not reachable" | `docker compose logs ollama`; `docker exec ragentis-ollama ollama list` shows the model? |
| Answers very slow | normal on CPU for long answers; close other programs; give Docker more RAM; GPU helps most |
| Upload stays "Processing" | `docker compose logs backend`; large scanned PDFs take ~5–10 s per page for OCR |
| Port already in use | change `RAGENTIS_HTTPS_PORT` / `RAGENTIS_HTTP_PORT` in `.env` |
| Licence expired | install the renewed `.license` file on the Licence page; documents are kept |
| Everyone signed out after update | `JWT_SECRET_KEY` changed – expected once |

Health at a glance: **Insights → System health**.
