@echo off
rem RAGENTIS backup for Windows (run from the project folder). Read-only for the running system.
setlocal
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%i
set DEST=backups\%STAMP%
mkdir "%DEST%" || exit /b 1
echo 1/4 Database...
docker compose exec -T postgres pg_dump -U postgres -d offline_rag --format=custom > "%DEST%\database.dump" || goto :fail
echo 2/4 Uploaded files...
docker compose exec -T backend tar -C /app -czf - uploads > "%DEST%\uploads.tar.gz" || goto :fail
echo 3/4 Vector index...
docker compose exec -T backend tar -C /app -czf - chroma_db > "%DEST%\chroma_db.tar.gz" || goto :fail
echo 4/4 Reports...
docker compose exec -T backend tar -C /app -czf - reports > "%DEST%\reports.tar.gz" || goto :fail
powershell -NoProfile -Command "Set-Location '%DEST%'; Get-ChildItem -File | Where-Object Name -ne 'SHA256SUMS' | ForEach-Object { '{0}  {1}' -f (Get-FileHash -Algorithm SHA256 $_.Name).Hash.ToLower(), $_.Name } | Set-Content -Encoding ascii SHA256SUMS"
echo Backup written to %DEST%
echo Keep it on an encrypted drive. Keep a copy of .env too (it is NOT in the backup).
exit /b 0
:fail
echo Backup FAILED. Is RAGENTIS running? (docker compose ps)
exit /b 1
