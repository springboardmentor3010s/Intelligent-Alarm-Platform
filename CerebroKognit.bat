REM CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
@echo off
setlocal
REM ============================================================
REM  CerebroKognit.bat - Launch the ENTIRE CerebroKognit stack in ONE
REM  terminal: database -> backend -> web -> mobile (mobile LAST).
REM
REM  By default it runs inside this terminal, streaming labelled,
REM  colour-coded output from every service so you only need one
REM  window. Press Ctrl+C to stop everything.
REM
REM  Options:
REM    CerebroKognit.bat -NoDb             skip Postgres (use local SQLite)
REM    CerebroKognit.bat -TimeLimitSec 60   auto-stop after 60s (for scripts/CI)
REM ============================================================
cd /d "%~dp0"

REM Use the highest available PowerShell 7; fall back to 5.1 (pwsh vs powershell).
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" (
    set "PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
) else if exist "%ProgramFiles(x86)%\PowerShell\7\pwsh.exe" (
    set "PS=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
) else (
    set "PS=powershell.exe"
)

echo.
echo  Starting CerebroKognit - database - backend - web - mobile (last) ...
echo  All output stays in THIS terminal. Ctrl+C to stop.
echo.

if /i "%~1"=="/?" (
    echo  CerebroKognit.bat [-NoDb] [-TimeLimitSec N]
) else (
    "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_all.ps1" %*
)

endlocal