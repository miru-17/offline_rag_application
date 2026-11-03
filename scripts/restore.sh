#!/bin/sh
# RAGENTIS restore from a folder made by backup.sh (plain or encrypted).
# THIS REPLACES the current database, uploads and vector index.
# Usage:  sh scripts/restore.sh backups/<timestamp> --yes-replace-current-data
# Encrypted backups need RAGENTIS_BACKUP_PASSPHRASE set to the same passphrase.
set -e
SRC="$1"
if [ -z "$SRC" ] || { [ ! -f "$SRC/database.dump" ] && [ ! -f "$SRC/database.dump.enc" ]; }; then
  echo "Usage: sh scripts/restore.sh backups/<timestamp> --yes-replace-current-data"; exit 1
fi
if [ "$2" != "--yes-replace-current-data" ]; then
  echo "Refusing to run: restoring replaces ALL current data."
  echo "Make a fresh backup first, then re-run with --yes-replace-current-data"; exit 1
fi
( cd "$SRC" && sha256sum -c SHA256SUMS )

WORK="$SRC"
if [ -f "$SRC/database.dump.enc" ]; then
  [ -n "$RAGENTIS_BACKUP_PASSPHRASE" ] || { echo "This backup is encrypted: set RAGENTIS_BACKUP_PASSPHRASE."; exit 1; }
  # Decrypt everything first: a wrong passphrase stops here, before anything is changed.
  WORK="$SRC/.decrypted"
  rm -rf "$WORK"; mkdir -p "$WORK"
  trap 'rm -rf "$WORK"' EXIT
  for f in database.dump uploads.tar.gz chroma_db.tar.gz reports.tar.gz; do
    [ -f "$SRC/$f.enc" ] || continue
    echo "Decrypting $f..."
    docker compose run --rm -T --no-deps -e RAGENTIS_BACKUP_PASSPHRASE --entrypoint python backend \
      -m app.tools.backup_crypto decrypt < "$SRC/$f.enc" > "$WORK/$f" || { echo "Restore FAILED: could not decrypt $f."; exit 1; }
  done
fi

echo "Stopping the API (database keeps running)..."
docker compose stop backend

echo "Restoring database..."
docker compose exec -T postgres pg_restore -U postgres -d offline_rag --clean --if-exists < "$WORK/database.dump"

echo "Restoring files and vector index..."
docker compose run --rm -T --no-deps --entrypoint sh backend -c \
  "rm -rf /app/uploads/* /app/chroma_db/* && tar -C /app -xzf - " < "$WORK/uploads.tar.gz"
docker compose run --rm -T --no-deps --entrypoint sh backend -c "tar -C /app -xzf -" < "$WORK/chroma_db.tar.gz"
if [ -f "$WORK/reports.tar.gz" ]; then
  docker compose run --rm -T --no-deps --entrypoint sh backend -c \
    "rm -rf /app/reports/* && tar -C /app -xzf -" < "$WORK/reports.tar.gz"
fi
# The API runs as user 10001; restored files must belong to it.
docker compose run --rm -T --no-deps --entrypoint sh backend -c \
  "chown -R 10001:10001 /app/uploads /app/chroma_db /app/reports"

docker compose start backend
echo "Restore complete."
