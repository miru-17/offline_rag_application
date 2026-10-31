#!/bin/sh
# RAGENTIS backup: database + uploaded files + vector index + reports, into ./backups/<timestamp>/
# Read-only for the running system. Run from the project folder:  sh scripts/backup.sh
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="backups/$STAMP"
mkdir -p "$DEST"

echo "1/4 Database..."
docker compose exec -T postgres pg_dump -U postgres -d offline_rag --format=custom > "$DEST/database.dump"

echo "2/4 Uploaded files..."
docker compose exec -T backend tar -C /app -czf - uploads > "$DEST/uploads.tar.gz"

echo "3/4 Vector index..."
docker compose exec -T backend tar -C /app -czf - chroma_db > "$DEST/chroma_db.tar.gz"

echo "4/4 Reports..."
docker compose exec -T backend tar -C /app -czf - reports > "$DEST/reports.tar.gz"

( cd "$DEST" && sha256sum database.dump uploads.tar.gz chroma_db.tar.gz reports.tar.gz > SHA256SUMS )
echo "Backup written to $DEST"
echo "Keep it on an encrypted drive: it contains every uploaded document."
echo "Also keep a copy of the .env file somewhere safe (it is NOT in the backup):"
echo "without POSTGRES_PASSWORD, JWT_SECRET_KEY and DATA_ENCRYPTION_KEY a restore is incomplete."
