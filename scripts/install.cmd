@echo off
rem RAGENTIS offline installer for Windows (Docker Desktop must be running).
rem Double-click, or run from the unpacked package folder.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
