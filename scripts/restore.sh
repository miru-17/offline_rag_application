#!/bin/sh
# RAGENTIS restore from a folder made by backup.sh.
# THIS REPLACES the current database, uploads and vector index.
# Usage:  sh scripts/restore.sh backups/<timestamp> --yes-replace-current-data
set -e
SRC="$1"
if [ -z "$SRC" ] || [ ! -f "$SRC/database.dump" ]; then
  echo "Usage: sh scripts/restore.sh backups/<timestamp> --yes-replace-current-data"; exit 1
fi
if [ "$2" != "--yes-replace-current-data" ]; then
  echo "Refusing to run: restoring replaces ALL current data."
  echo "Make a fresh backup first, then re-run with --yes-replace-current-data"; exit 1
fi
( cd "$SRC" && sha256sum -c SHA256SUMS )

echo "Stopping the API (database keeps running)..."
docker compose stop backend

echo "Restoring database..."
docker compose exec -T postgres pg_restore -U postgres -d offline_rag --clean --if-exists < "$SRC/database.dump"

echo "Restoring files and vector index..."
docker compose run --rm -T --no-deps --entrypoint sh backend -c \
  "rm -rf /app/uploads/* /app/chroma_db/* && tar -C /app -xzf - " < "$SRC/uploads.tar.gz"
docker compose run --rm -T --no-deps --entrypoint sh backend -c "tar -C /app -xzf -" < "$SRC/chroma_db.tar.gz"

docker compose start backend
echo "Restore complete."
