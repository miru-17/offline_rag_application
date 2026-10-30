#!/bin/sh
# RAGENTIS backup: database + uploaded files + vector index, into ./backups/<timestamp>/
# Read-only for the running system. Run from the project folder:  sh scripts/backup.sh
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="backups/$STAMP"
mkdir -p "$DEST"

echo "1/3 Database..."
docker compose exec -T postgres pg_dump -U postgres -d offline_rag --format=custom > "$DEST/database.dump"

echo "2/3 Uploaded files..."
docker compose exec -T backend tar -C /app -czf - uploads > "$DEST/uploads.tar.gz"

echo "3/3 Vector index..."
docker compose exec -T backend tar -C /app -czf - chroma_db > "$DEST/chroma_db.tar.gz"

( cd "$DEST" && sha256sum database.dump uploads.tar.gz chroma_db.tar.gz > SHA256SUMS )
echo "Backup written to $DEST"
echo "Keep it on an encrypted drive: it contains every uploaded document."
