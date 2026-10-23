@echo off
cd /d "%~dp0"
echo This DELETES all Wakeful data (database + logs) and starts from scratch.
set /p ok=Type YES to continue: 
if /i not "%ok%"=="YES" exit /b 0
docker compose down -v
pause
