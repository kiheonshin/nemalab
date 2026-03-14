@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -Command "try { [void](Invoke-WebRequest -Uri 'http://127.0.0.1:4173' -UseBasicParsing -TimeoutSec 2); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Nema Lab Server" /min node scripts\serve-dist.cjs
  timeout /t 2 /nobreak >nul
)

start "" "http://127.0.0.1:4173"
