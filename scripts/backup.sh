#!/bin/sh
# RAGENTIS backup: database + uploaded files + vector index + reports, into ./backups/<timestamp>/
# Read-only for the running system. Run from the project folder:  sh scripts/backup.sh
#
# Encrypted backup (recommended): set a passphrase first (at least 12 characters)
#     export RAGENTIS_BACKUP_PASSPHRASE='...'
# Files are then written as *.enc (AES-256-GCM). Keep the passphrase safe:
# without it the backup cannot be restored.
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="backups/$STAMP"
mkdir -p "$DEST"

if [ -n "$RAGENTIS_BACKUP_PASSPHRASE" ]; then
  EXT=".enc"
  echo "Encrypting the backup with RAGENTIS_BACKUP_PASSPHRASE."
else
  EXT=""
  echo "WARNING: backup is NOT encrypted (set RAGENTIS_BACKUP_PASSPHRASE to encrypt it)."
fi

# Writes stdin to $1, encrypted when a passphrase is set.
save() {
  if [ -n "$EXT" ]; then
    docker compose exec -T -e RAGENTIS_BACKUP_PASSPHRASE backend python -m app.tools.backup_crypto encrypt > "$1"
  else
    cat > "$1"
  fi
}

echo "1/4 Database..."
docker compose exec -T postgres pg_dump -U postgres -d offline_rag --format=custom > "$DEST/.db.part"
save "$DEST/database.dump$EXT" < "$DEST/.db.part"
rm -f "$DEST/.db.part"

echo "2/4 Uploaded files..."
docker compose exec -T backend tar -C /app -czf - uploads | save "$DEST/uploads.tar.gz$EXT"

echo "3/4 Vector index..."
docker compose exec -T backend tar -C /app -czf - chroma_db | save "$DEST/chroma_db.tar.gz$EXT"

echo "4/4 Reports..."
docker compose exec -T backend tar -C /app -czf - reports | save "$DEST/reports.tar.gz$EXT"

for f in database.dump uploads.tar.gz chroma_db.tar.gz reports.tar.gz; do
  [ -s "$DEST/$f$EXT" ] || { echo "Backup FAILED: $f is empty."; exit 1; }
done
( cd "$DEST" && sha256sum "database.dump$EXT" "uploads.tar.gz$EXT" "chroma_db.tar.gz$EXT" "reports.tar.gz$EXT" > SHA256SUMS )
echo "Backup written to $DEST"
[ -z "$EXT" ] && echo "Keep it on an encrypted drive: it contains every uploaded document."
echo "Also keep a copy of the .env file somewhere safe (it is NOT in the backup):"
echo "without POSTGRES_PASSWORD, JWT_SECRET_KEY and DATA_ENCRYPTION_KEY a restore is incomplete."
