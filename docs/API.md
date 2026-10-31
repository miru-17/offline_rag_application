# RAGENTIS REST API (for other company systems)

Base address: `https://<server>:8443/api`

Authenticate with an API key created by an administrator (**API keys** page):

```
X-API-Key: rgk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A key acts as one RAGENTIS account and can do only what **both** its scopes and
that account's role allow. Keys can expire and can be revoked at any time.
Every call is rate-limited per key and recorded in the audit log with the key's
name.

| Scope | Endpoints |
| --- | --- |
| `query` | `POST /query/`, `POST /query/stream`, `GET /conversations/`, `GET /conversations/{id}` |
| `documents:read` | `GET /documents/`, `GET /documents/{id}`, `GET /documents/{id}/versions`, `GET /documents/{id}/file` |
| `documents:write` | `POST /documents/upload`, `POST /documents/{id}/retry`, `DELETE /documents/{id}` |
| (any key) | `GET /auth/me` |

All other endpoints (users, settings, licence, API keys, …) refuse API keys.

## Ask a question

```bash
curl -X POST https://ragentis.corp.local:8443/api/query/ \
  -H "X-API-Key: $RAGENTIS_KEY" -H "Content-Type: application/json" \
  -d '{"query": "What is the hotel limit for managers?"}'
```

Response (shortened):

```json
{
  "conversation_id": "…",
  "answer": "Managers may spend up to ₹6,000 per night [1].",
  "status": "answered",
  "sources": [
    {"ref": 1, "document_id": "…", "filename": "Travel Policy.pdf", "page": 3,
     "excerpt": "…", "score": 0.82, "match": "meaning"}
  ]
}
```

`status` is `answered` or `not_found` (the documents do not contain the answer).
Send the same `conversation_id` again for follow-up questions.

`POST /query/stream` returns Server-Sent Events: `meta`, many `token`, `sources`,
`done` (or `error`).

## Upload a document

```bash
curl -X POST https://ragentis.corp.local:8443/api/documents/upload \
  -H "X-API-Key: $RAGENTIS_KEY" \
  -F "file=@Invoice-7781.pdf" -F "visibility=PRIVATE"
```

Optional form fields: `visibility` (`PRIVATE`, `GROUP`, `TENANT` – `TENANT` needs
an ADMIN account), `group_id`, `replace_document_id` (upload as a new version),
`allow_duplicate=true`. Returns `202` with the document; poll
`GET /documents/{id}` until `status` is `ready` or `failed`.

## Errors

| Code | Meaning |
| --- | --- |
| 401 | key missing, wrong, expired or revoked |
| 403 | the key's scope or account role does not allow this, or the licence lacks `api` |
| 409 | duplicate file / document busy |
| 429 | too many requests – wait and retry |
| 503 | AI engine busy or not running |

Python example:

```python
import requests
S = requests.Session()
S.headers["X-API-Key"] = "rgk_…"
S.verify = "ragentis-root.crt"      # the RAGENTIS root certificate (admin guide §3)
r = S.post("https://ragentis.corp.local:8443/api/query/", json={"query": "leave policy"})
print(r.json()["answer"])
```
