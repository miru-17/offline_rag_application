@echo off
rem RAGENTIS restore for Windows. REPLACES current data.
rem Usage: scripts\restore.cmd backups\<timestamp> --yes-replace-current-data
rem Encrypted backups need:  set RAGENTIS_BACKUP_PASSPHRASE=the same passphrase
setlocal
set SRC=%~1
if "%SRC%"=="" goto :usage
if not exist "%SRC%\database.dump" if not exist "%SRC%\database.dump.enc" goto :usage
if not "%~2"=="--yes-replace-current-data" (
  echo Refusing to run: restoring replaces ALL current data.
  echo Make a fresh backup first, then re-run with --yes-replace-current-data
  exit /b 1
)
powershell -NoProfile -Command "$bad=0; Get-Content '%SRC%\SHA256SUMS' | ForEach-Object { $h,$f = $_.Trim() -split '\s+',2; if ((Get-FileHash -Algorithm SHA256 (Join-Path '%SRC%' $f)).Hash.ToLower() -ne $h) { Write-Host ('Damaged: ' + $f); $bad=1 } }; exit $bad" || exit /b 1
set WORK=%SRC%
if exist "%SRC%\database.dump.enc" (
  if not defined RAGENTIS_BACKUP_PASSPHRASE (
    echo This backup is encrypted: set RAGENTIS_BACKUP_PASSPHRASE first.
    exit /b 1
  )
  set "WORK=%SRC%\.decrypted"
)
if not "%WORK%"=="%SRC%" (
  rem Decrypt everything first: a wrong passphrase stops here, before anything is changed.
  if exist "%WORK%" rmdir /s /q "%WORK%"
  mkdir "%WORK%"
  for %%f in (database.dump uploads.tar.gz chroma_db.tar.gz reports.tar.gz) do (
    if exist "%SRC%\%%f.enc" (
      echo Decrypting %%f...
      docker compose run --rm -T --no-deps -e RAGENTIS_BACKUP_PASSPHRASE --entrypoint python backend -m app.tools.backup_crypto decrypt < "%SRC%\%%f.enc" > "%WORK%\%%f" || goto :decryptfail
    )
  )
)
echo Stopping the API (database keeps running)...
docker compose stop backend
echo Restoring database...
docker compose exec -T postgres pg_restore -U postgres -d offline_rag --clean --if-exists < "%WORK%\database.dump"
echo Restoring files and vector index...
docker compose run --rm -T --no-deps --entrypoint sh backend -c "rm -rf /app/uploads/* /app/chroma_db/* && tar -C /app -xzf -" < "%WORK%\uploads.tar.gz" || goto :fail
docker compose run --rm -T --no-deps --entrypoint sh backend -c "tar -C /app -xzf -" < "%WORK%\chroma_db.tar.gz" || goto :fail
if exist "%WORK%\reports.tar.gz" docker compose run --rm -T --no-deps --entrypoint sh backend -c "rm -rf /app/reports/* && tar -C /app -xzf -" < "%WORK%\reports.tar.gz"
docker compose run --rm -T --no-deps --entrypoint sh backend -c "chown -R 10001:10001 /app/uploads /app/chroma_db /app/reports"
docker compose start backend
if not "%WORK%"=="%SRC%" rmdir /s /q "%WORK%"
echo Restore complete.
exit /b 0
:usage
echo Usage: scripts\restore.cmd backups\^<timestamp^> --yes-replace-current-data
exit /b 1
:decryptfail
if exist "%WORK%" rmdir /s /q "%WORK%"
echo Restore FAILED: wrong passphrase or damaged backup. Nothing was changed.
exit /b 1
:fail
echo Restore FAILED. Start the API again with: docker compose start backend
exit /b 1
