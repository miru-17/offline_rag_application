# End-to-end tests

Real FastAPI + PostgreSQL + ChromaDB; the two AI models are replaced by
stand-ins (`sitecustomize.py` for the embedding model/tokenizer,
`fake_ollama.py` for Ollama) so the tests run without downloads.

```bash
./reset.sh                 # fresh database, copy of backend, fake models, start API
python api_test.py         # 143 API checks
LOGIN_RATE_LIMIT=1000/minute ./reset.sh && python security_test.py   # 32 security checks
node ui_test.js            # 19 browser checks (needs `npm run dev` on :5173 and Playwright)
```

Paths can be changed with E2E_DIR, E2E_RUN and E2E_PYTHON. These tests prove
behaviour and security rules, not answer quality: use `scripts/evaluate.py`
with the real models for that.
