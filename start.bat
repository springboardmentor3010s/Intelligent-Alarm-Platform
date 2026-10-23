@echo off
setlocal
cd /d "%~dp0"
title Wakeful - starting

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker is not installed or not on PATH. Install Docker Desktop first, then run this again.
  pause & exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is not running. Open Docker Desktop, wait until it says "running", then run this again.
  pause & exit /b 1
)

if not exist .env (
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\make_env.ps1"
  if errorlevel 1 ( echo Could not create .env & pause & exit /b 1 )
)

echo Building and starting Wakeful (first run takes several minutes)...
docker compose up --build -d
if errorlevel 1 ( echo Something failed - see the messages above. & pause & exit /b 1 )

echo.
echo Wakeful is starting. Opening http://localhost:5173 in a few seconds...
timeout /t 12 >nul
start http://localhost:5173
echo.
echo To stop it later: double-click stop.bat      Logs: docker compose logs -f backend
pause
