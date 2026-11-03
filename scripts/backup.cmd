@echo off
rem RAGENTIS backup for Windows (run from the project folder). Read-only for the running system.
rem Encrypted backup (recommended):  set RAGENTIS_BACKUP_PASSPHRASE=your long passphrase
rem Files are then written as *.enc (AES-256-GCM). Without the passphrase they cannot be restored.
setlocal
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%i
set DEST=backups\%STAMP%
mkdir "%DEST%" || exit /b 1
set EXT=
set ENC=
if defined RAGENTIS_BACKUP_PASSPHRASE (
  set EXT=.enc
  set "ENC=| docker compose exec -T -e RAGENTIS_BACKUP_PASSPHRASE backend python -m app.tools.backup_crypto encrypt"
  echo Encrypting the backup with RAGENTIS_BACKUP_PASSPHRASE.
) else (
  echo WARNING: backup is NOT encrypted. Set RAGENTIS_BACKUP_PASSPHRASE to encrypt it.
)
echo 1/4 Database...
docker compose exec -T postgres pg_dump -U postgres -d offline_rag --format=custom %ENC% > "%DEST%\database.dump%EXT%" || goto :fail
echo 2/4 Uploaded files...
docker compose exec -T backend tar -C /app -czf - uploads %ENC% > "%DEST%\uploads.tar.gz%EXT%" || goto :fail
echo 3/4 Vector index...
docker compose exec -T backend tar -C /app -czf - chroma_db %ENC% > "%DEST%\chroma_db.tar.gz%EXT%" || goto :fail
echo 4/4 Reports...
docker compose exec -T backend tar -C /app -czf - reports %ENC% > "%DEST%\reports.tar.gz%EXT%" || goto :fail
for %%f in (database.dump uploads.tar.gz chroma_db.tar.gz reports.tar.gz) do (
  for %%s in ("%DEST%\%%f%EXT%") do if %%~zs==0 goto :fail
)
powershell -NoProfile -Command "Set-Location '%DEST%'; Get-ChildItem -File | Where-Object Name -ne 'SHA256SUMS' | ForEach-Object { '{0}  {1}' -f (Get-FileHash -Algorithm SHA256 $_.Name).Hash.ToLower(), $_.Name } | Set-Content -Encoding ascii SHA256SUMS"
echo Backup written to %DEST%
if not defined EXT echo Keep it on an encrypted drive.
echo Keep a copy of .env too (it is NOT in the backup).
exit /b 0
:fail
echo Backup FAILED. Is RAGENTIS running? (docker compose ps)
exit /b 1
