# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
# dev.ps1 - one-shot local launcher for backend + web (+ optional mobile Metro).
#
# WHY A SCRIPT: launching uvicorn via `activate` + bare `uvicorn` can resolve to a
# stray Python (e.g. a global 3.11) that lacks the project deps, so the backend
# crashes at import and every /api/v1 call from the web proxy fails with
# ECONNREFUSED. This script pins the EXACT backend venv interpreter so that can
# never happen.
#
# Usage:
#   .\dev.ps1              # backend (8000) + web (5173)
#   .\dev.ps1 -Mobile      # also start Metro (8081)
#   .\dev.ps1 -BackendOnly # just the backend
#   .\dev.ps1 -WebOnly     # just the web dashboard

param(
  [switch]$BackendOnly,
  [switch]$WebOnly,
  [switch]$Mobile
)

$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$web = Join-Path $root 'web'
$mobileDir = Join-Path $root 'mobile'
$py = Join-Path $backend '.venv\Scripts\python.exe'

function Test-Port([int]$port) {
  (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) -ne $null
}

$startBackend = -not $WebOnly
if (-not $BackendOnly -and -not $WebOnly) { $startBackend = $true }

# ---- Backend: FastAPI on :8000 ---------------------------------------------
if ($startBackend) {
  if (Test-Port 8000) {
    Write-Host "[backend] already listening on :8000" -ForegroundColor Green
  }
  elseif (Test-Path $py) {
    Write-Host "[backend] starting uvicorn (pinned venv interpreter) on :8000" -ForegroundColor Cyan
    Start-Process -FilePath $py -ArgumentList "-m uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $backend -WindowStyle Hidden
    # wait for it to come up
    for ($i = 0; $i -lt 20; $i++) {
      Start-Sleep -Milliseconds 500
      if (Test-Port 8000) { Write-Host "  -> healthy" -ForegroundColor Green; break }
    }
    if (-not (Test-Port 8000)) { Write-Host "  !! backend did not bind :8000 - see backend/.venv for deps (pip install -r requirements.txt)" -ForegroundColor Red }
  }
  else {
    Write-Host "[backend] venv missing at $py. Create + install: python -m venv backend\.venv ; backend\.venv\Scripts\pip install -r backend\requirements.txt" -ForegroundColor Red
  }
}

# ---- Web: Vite on :5173 ----------------------------------------------------
if (-not $BackendOnly) {
  if (Test-Port 5173) {
    Write-Host "[web] already listening on :5173" -ForegroundColor Green
  }
  elseif (Test-Path (Join-Path $web 'node_modules')) {
    Write-Host "[web] starting vite on :5173" -ForegroundColor Cyan
    Start-Process -FilePath 'npm.cmd' -ArgumentList "run", "dev" -WorkingDirectory $web -WindowStyle Hidden
  }
  else {
    Write-Host "[web] node_modules missing in $web - run: cd web ; npm install" -ForegroundColor Red
  }
}

# ---- Mobile: Metro on :8081 (optional) --------------------------------------
if ($Mobile) {
  if (Test-Port 8081) {
    Write-Host "[mobile] Metro already listening on :8081" -ForegroundColor Green
  }
  elseif (Test-Path (Join-Path $mobileDir 'node_modules')) {
    Write-Host "[mobile] starting Expo/Metro on :8081" -ForegroundColor Cyan
    Start-Process -FilePath 'npx.cmd' -ArgumentList "expo", "start" -WorkingDirectory $mobileDir -WindowStyle Hidden
  }
  else {
    Write-Host "[mobile] node_modules missing in $mobileDir - run: cd mobile ; npm install" -ForegroundColor Red
  }
}

Write-Host "`nDone. Give each service a couple of seconds to boot, then:" -ForegroundColor Yellow
Write-Host "  Backend API     http://localhost:8000/health"
Write-Host "  Web dashboard   http://localhost:5173"
if ($Mobile) { Write-Host "  Mobile (Metro)  exp://localhost:8081 (Expo Go)" }
