#!/bin/sh
# Build an OFFLINE installation package for a customer computer without internet.
# Run on the VENDOR machine (with internet and Docker), from the project folder:
#
#     sh scripts/package-offline.sh            # default model llama3.2:3b
#     MODELS="llama3.2:3b qwen2.5:3b" sh scripts/package-offline.sh
#
# Result: dist-offline/ragentis-offline-<date>.tar.gz  (+ .sha256)
# It contains the Docker images, the AI model, the embedding model, the
# installer, docs and scripts. No secrets and no customer data are included.
set -eu

MODELS="${MODELS:-llama3.2:3b}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-all-MiniLM-L6-v2}"
STAMP=$(date +%Y%m%d)
WORK="dist-offline/ragentis-offline-$STAMP"
OLLAMA_IMAGE="ollama/ollama:latest"
POSTGRES_IMAGE="postgres:16"

rm -rf "$WORK" && mkdir -p "$WORK/models/ollama" "$WORK/models/hf_cache"

echo "1/5 Building RAGENTIS images..."
docker compose build backend web
docker pull "$POSTGRES_IMAGE"
docker pull "$OLLAMA_IMAGE"

echo "2/5 Downloading AI model(s): $MODELS"
docker rm -f ragentis-pkg-ollama >/dev/null 2>&1 || true
docker run -d --name ragentis-pkg-ollama -v "$(pwd)/$WORK/models/ollama:/root/.ollama" "$OLLAMA_IMAGE" >/dev/null
sleep 5
for model in $MODELS; do
  docker exec ragentis-pkg-ollama ollama pull "$model"
done
docker rm -f ragentis-pkg-ollama >/dev/null

echo "3/5 Downloading embedding model: $EMBEDDING_MODEL"
docker run --rm --entrypoint python -e HF_HOME=/hf_cache \
  -v "$(pwd)/$WORK/models/hf_cache:/hf_cache" ragentis-backend:latest \
  -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('$EMBEDDING_MODEL')"

echo "4/5 Saving images..."
docker save -o "$WORK/images.tar" ragentis-backend:latest ragentis-web:latest "$POSTGRES_IMAGE" "$OLLAMA_IMAGE"

echo "5/5 Adding installer, settings template, scripts and docs..."
# The package uses the loaded images, so the build sections are removed.
sed '/^    build: /d' docker-compose.yml > "$WORK/docker-compose.yml"
cp .env.example "$WORK/"
mkdir -p "$WORK/scripts" "$WORK/docs" "$WORK/watch" "$WORK/certs"
cp scripts/backup.sh scripts/restore.sh scripts/backup.cmd scripts/restore.cmd "$WORK/scripts/"
cp scripts/install.sh scripts/install.ps1 scripts/install.cmd "$WORK/"
cp docs/ADMIN_GUIDE.md docs/USER_GUIDE.md docs/API.md "$WORK/docs/"
echo "$MODELS" > "$WORK/models/MODELS.txt"
echo "$EMBEDDING_MODEL" > "$WORK/models/EMBEDDING_MODEL.txt"

( cd "$WORK" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
tar -C dist-offline -czf "dist-offline/ragentis-offline-$STAMP.tar.gz" "ragentis-offline-$STAMP"
( cd dist-offline && sha256sum "ragentis-offline-$STAMP.tar.gz" > "ragentis-offline-$STAMP.tar.gz.sha256" )
echo "Package ready: dist-offline/ragentis-offline-$STAMP.tar.gz"
echo "Copy it (and the .sha256 file) to the customer computer and run install.cmd (Windows) or install.sh (Linux)."
