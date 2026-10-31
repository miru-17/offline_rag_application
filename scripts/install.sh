#!/bin/sh
# RAGENTIS offline installer (Linux). Run inside the unpacked package folder:
#     sh install.sh
# Needs Docker with the compose plugin. No internet is used.
# Safe to run again: existing data and an existing .env are kept.
set -eu
cd "$(dirname "$0")"

echo "1/6 Checking the package..."
sha256sum -c --quiet SHA256SUMS || { echo "The package is damaged. Copy it again."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker with 'docker compose' is required."; exit 1; }

echo "2/6 Loading Docker images (a few minutes)..."
docker load -i images.tar

echo "3/6 Settings (.env)..."
if [ -f .env ]; then
  echo "    keeping the existing .env"
else
  random() { head -c 48 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-48; }
  fernet=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_')
  sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(random)|" \
      -e "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$(random)|" \
      -e "s|^DATA_ENCRYPTION_KEY=.*|DATA_ENCRYPTION_KEY=$fernet|" \
      -e "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=$(cut -d' ' -f1 models/MODELS.txt)|" \
      -e "s|^EMBEDDING_MODEL=.*|EMBEDDING_MODEL=$(cat models/EMBEDDING_MODEL.txt)|" \
      .env.example > .env
  printf '\n# Fixed project name so volumes are found again after updates.\nCOMPOSE_PROJECT_NAME=ragentis\n' >> .env
  chmod 600 .env
  echo "    created .env with new random secrets - BACK IT UP (see docs/ADMIN_GUIDE.md)"
fi
PROJECT=$(grep -E '^COMPOSE_PROJECT_NAME=' .env | cut -d= -f2 || true)
PROJECT=${PROJECT:-$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}

echo "4/6 Installing the AI models (only into empty volumes)..."
copy_into_volume() {  # volume, source folder, image
  docker volume create "$1" >/dev/null
  docker run --rm --entrypoint sh -v "$1:/dst" -v "$(pwd)/$2:/src:ro" "$3" -c \
    'if [ -z "$(ls -A /dst 2>/dev/null)" ]; then cp -a /src/. /dst/ && echo "    copied"; else echo "    already present - kept"; fi'
}
copy_into_volume "${PROJECT}_ollama_data" models/ollama ollama/ollama:latest
copy_into_volume "${PROJECT}_hf_cache" models/hf_cache ragentis-backend:latest
docker run --rm --entrypoint sh -v "${PROJECT}_hf_cache:/hf" ragentis-backend:latest -c "chown -R 10001:10001 /hf"

echo "5/6 Starting RAGENTIS..."
docker compose up -d

echo "6/6 Waiting for the server..."
i=0
until docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 90 ] && { echo "The server did not start. See: docker compose logs backend"; exit 1; }
  sleep 2
done
PORT=$(grep -E '^RAGENTIS_HTTPS_PORT=' .env | cut -d= -f2); PORT=${PORT:-8443}
echo
echo "RAGENTIS is running:  https://localhost:$PORT"
echo "First visit: create the administrator account, then install the licence file."
echo "Your browser will warn about the certificate until the RAGENTIS root"
echo "certificate is trusted - see docs/ADMIN_GUIDE.md section 3."
