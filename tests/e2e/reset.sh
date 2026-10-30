#!/bin/bash
# Rebuild a clean test copy of the backend and start it (fake models).
H2=/tmp/claude-0/harness2
pgrep -f "bin/uvicorn" | xargs -r kill 2>/dev/null
pgrep -f "harness2/fake_ollama.py" | xargs -r kill 2>/dev/null
pgrep -f "harness/fake_ollama.py" | xargs -r kill 2>/dev/null
sleep 1
psql -h localhost -U postgres -qc "drop database if exists rag_app;" ; psql -h localhost -U postgres -qc "create database rag_app;"
rm -rf /tmp/claude-0/run2 && cp -r /home/claude/miru-17/offline_rag_application/backend /tmp/claude-0/run2 && cd /tmp/claude-0/run2 && rm -rf chroma_db uploads
mkdir -p $H2/keys
if [ ! -f $H2/keys/priv.pem ]; then
  /tmp/claude-0/venv/bin/python tools/license_issuer.py init-keys --private-key $H2/keys/priv.pem --public-key $H2/keys/pub.pem >/dev/null
fi
export PYTHONPATH=$H2 DATABASE_URL=postgresql+psycopg2://postgres@localhost:5432/rag_app \
  JWT_SECRET_KEY=test-secret-0123456789-abcdefghijklmnop LICENSE_PUBLIC_KEY_PATH=$H2/keys/pub.pem \
  LOG_LEVEL=INFO ALLOW_SELF_REGISTRATION=${ALLOW_SELF_REGISTRATION:-true} \
  QUERY_RATE_LIMIT=${QUERY_RATE_LIMIT:-1000/minute} UPLOAD_RATE_LIMIT=${UPLOAD_RATE_LIMIT:-1000/minute} \
  REGISTER_RATE_LIMIT=1000/minute
setsid nohup /tmp/claude-0/venv/bin/python $H2/fake_ollama.py > $H2/ollama.log 2>&1 &
/tmp/claude-0/venv/bin/python -m app.database.bootstrap 2>&1 | grep -v INFO
psql -h localhost -U postgres -d rag_app -qc "insert into tenants(id,name,retrieval_depth,source_attribution,pii_mode) values (gen_random_uuid(),'Other Corp',5,true,'flag');"
setsid nohup /tmp/claude-0/venv/bin/uvicorn app.main:app --port 8000 > /tmp/claude-0/run2/server.log 2>&1 &
for i in $(seq 1 60); do curl -s localhost:8000/health >/dev/null && break; sleep 1; done; echo READY
