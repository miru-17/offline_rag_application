@echo off
rem RAGENTIS restore for Windows. REPLACES current data.
rem Usage: scripts\restore.cmd backups\<timestamp> --yes-replace-current-data
setlocal
set SRC=%~1
if "%SRC%"=="" goto :usage
if not exist "%SRC%\database.dump" goto :usage
if not "%~2"=="--yes-replace-current-data" (
  echo Refusing to run: restoring replaces ALL current data.
  echo Make a fresh backup first, then re-run with --yes-replace-current-data
  exit /b 1
)
powershell -NoProfile -Command "$bad=0; Get-Content '%SRC%\SHA256SUMS' | ForEach-Object { $h,$f = $_ -split '\s+',2; if ((Get-FileHash -Algorithm SHA256 (Join-Path '%SRC%' $f)).Hash.ToLower() -ne $h) { Write-Host ('Damaged: ' + $f); $bad=1 } }; exit $bad" || exit /b 1
echo Stopping the API (database keeps running)...
docker compose stop backend
echo Restoring database...
docker compose exec -T postgres pg_restore -U postgres -d offline_rag --clean --if-exists < "%SRC%\database.dump"
echo Restoring files and vector index...
docker compose run --rm -T --no-deps --entrypoint sh backend -c "rm -rf /app/uploads/* /app/chroma_db/* && tar -C /app -xzf -" < "%SRC%\uploads.tar.gz" || goto :fail
docker compose run --rm -T --no-deps --entrypoint sh backend -c "tar -C /app -xzf -" < "%SRC%\chroma_db.tar.gz" || goto :fail
if exist "%SRC%\reports.tar.gz" docker compose run --rm -T --no-deps --entrypoint sh backend -c "rm -rf /app/reports/* && tar -C /app -xzf -" < "%SRC%\reports.tar.gz"
docker compose run --rm -T --no-deps --entrypoint sh backend -c "chown -R 10001:10001 /app/uploads /app/chroma_db /app/reports"
docker compose start backend
echo Restore complete.
exit /b 0
:usage
echo Usage: scripts\restore.cmd backups\^<timestamp^> --yes-replace-current-data
exit /b 1
:fail
echo Restore FAILED. Start the API again with: docker compose start backend
exit /b 1
