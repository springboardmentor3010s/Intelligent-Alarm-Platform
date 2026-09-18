# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
# run_all.ps1 - launch the entire CerebroKognit stack in ONE terminal.
#
# Starts, in order: (1) PostgreSQL DB (docker), (2) backend API, (3) web dashboard,
# (4) mobile Expo/Metro LAST - and it runs in the FOREGROUND of this console so the
# Expo QR code + keyboard shortcuts render exactly like running `npx expo start`
# yourself. Backend/web stream as colour-labelled lines; press Ctrl+C or press `q`
# (or Ctrl+C) on the Expo screen to stop everything.

param(
  [switch]$NoDb,             # skip starting the PostgreSQL Docker container (local SQLite)
  [int]$TimeLimitSec = 0     # non-interactive path: auto-stop after N seconds (no QR needed)
)

$root = $PSScriptRoot
$backend   = Join-Path $root 'backend'
$web       = Join-Path $root 'web'
$mobileDir = Join-Path $root 'mobile'
$py        = Join-Path $backend '.venv\Scripts\python.exe'

$color = @{
  database = 'Magenta'
  backend  = 'Cyan'
  web      = 'Yellow'
  mobile   = 'Green'
}

function Show-Banner([string]$name, [string]$msg) {
  $c = $color[$name]
  Write-Host "`n$('='*60)" -ForegroundColor $c
  Write-Host "[$name] $msg" -ForegroundColor $c
  Write-Host $('='*60) -ForegroundColor $c
}

function Wait-Port([int]$port, [string]$name, [int]$timeoutSec = 30) {
  for ($t = 0; $t -lt $timeoutSec; $t++) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { Write-Host "[$name] ready on :$port (pid $($c.OwningProcess))" -ForegroundColor Green; return $c.OwningProcess }
    Start-Sleep -Milliseconds 1000
  }
  Write-Host "[$name] !! did not come up on :$port within ${timeoutSec}s - check it can run on its own" -ForegroundColor Red
  return $null
}

function Drain-Job($job) {
  if (-not $job) { return }
  $out = $job | Receive-Job -ErrorAction SilentlyContinue
  foreach ($line in $out) {
    $tag = "[$($job.Name)]"
    $line -split "`n" | ForEach-Object {
      if ($_.Trim() -ne '') { Write-Host "$tag $_" -ForegroundColor $color[$job.Name] }
    }
  }
}

function Stop-Jobs($jobs, $bound) {
  Write-Host "`nStopping services..." -ForegroundColor Yellow
  foreach ($key in @('web', 'backend')) {
    $job = $jobs[$key]
    if ($job) {
      Drain-Job $job
      try { Stop-Job -Job $job -ErrorAction SilentlyContinue } catch {}
      try { Remove-Job -Job $job -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
  foreach ($key in @('backend', 'web')) {
    if ($bound[$key]) {
      try { Stop-Process -Id $bound[$key] -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
  Write-Host "All services stopped." -ForegroundColor Green
}

$jobs = @{}
$bound = @{}

# ---- Stage 1: database ---------------------------------------------------------
Show-Banner 'database' 'STARTING PostgreSQL...'
if ($NoDb) {
  Write-Host "[database] -NoDb: skipping Postgres, using local SQLite (backend auto-inits)" -ForegroundColor Yellow
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
  & docker version 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[database] docker compose up -d db" -ForegroundColor $color.database
    & docker compose -f (Join-Path $root 'docker-compose.yml') up -d db 2>&1 | ForEach-Object { Write-Host "[database] $_" -ForegroundColor $color.database }
    # Wait until Postgres is actually ready (pg_isready inside the container).
    $composeFile = Join-Path $root 'docker-compose.yml'
    $pgReady = $false
    for ($t = 0; $t -lt 30; $t++) {
      & docker compose -f $composeFile exec -T db pg_isready -U cerebro_user -d cerebro_kognit 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
      Start-Sleep -Milliseconds 1000
    }
    if ($pgReady) {
      Write-Host "[database] Postgres ready (container cerebrokognit-db on localhost:5432)" -ForegroundColor Green
      # A fresh volume has no tables; bootstrap.py only auto-inits SQLite, so
      # migrate Postgres explicitly. Same URL the compose api service uses.
      if (Test-Path $py) {
        Write-Host "[database] applying migrations (alembic upgrade head)..." -ForegroundColor $color.database
        Push-Location $root
        try {
          $env:DATABASE_URL = 'postgresql+psycopg2://cerebro_user:change_me@localhost:5432/cerebro_kognit'
          & $py -m alembic upgrade head 2>&1 | ForEach-Object { Write-Host "[database] $_" -ForegroundColor $color.database }
          if ($LASTEXITCODE -eq 0) { Write-Host "[database] migrations applied" -ForegroundColor Green }
          else { Write-Host "[database] !! alembic upgrade head failed - run it manually (README §3) before using Postgres" -ForegroundColor Red }
        } finally {
          Pop-Location
        }
      } else {
        Write-Host "[database] venv missing - skipping migrations (see backend setup in README)" -ForegroundColor Yellow
      }
    } else {
      Write-Host "[database] !! Postgres did not become ready in 30s - backend may fail on fresh DB (run alembic upgrade head manually)" -ForegroundColor Red
    }
  } else {
    Write-Host "[database] Docker daemon not running - falling back to local SQLite (backend auto-inits it)" -ForegroundColor Yellow
  }
} else {
  Write-Host "[database] Docker not installed - falling back to local SQLite (backend auto-inits it)" -ForegroundColor Yellow
}

# ---- Stage 2: backend ----------------------------------------------------------
Show-Banner 'backend' 'STARTING uvicorn (pinned venv) on :8000...'
if (Test-Path $py) {
  $jobs['backend'] = Start-Job -Name backend -ArgumentList $backend, $py -ScriptBlock {
    param($wd, $exe)
    Set-Location $wd
    & $exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  }
} else {
  Write-Host "[backend] !! venv missing: run  python -m venv backend\.venv ; backend\.venv\Scripts\pip install -r backend\requirements.txt" -ForegroundColor Red
}
$bound['backend'] = Wait-Port 8000 'backend'
Start-Sleep -Milliseconds 800
Drain-Job $jobs['backend']

# ---- Stage 3: web --------------------------------------------------------------
Show-Banner 'web' 'STARTING vite on :5173...'
if (Test-Path (Join-Path $web 'node_modules')) {
  $jobs['web'] = Start-Job -Name web -ArgumentList $web -ScriptBlock {
    param($wd)
    Set-Location $wd
    npm run dev
  }
} else {
  Write-Host "[web] !! deps missing: run  cd web ; npm install" -ForegroundColor Red
}
$bound['web'] = Wait-Port 5173 'web'
Start-Sleep -Milliseconds 800
Drain-Job $jobs['web']

Write-Host "`n"
Write-Host "Backend + Web are UP in this terminal." -ForegroundColor White
Write-Host "  Backend   http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "  Web       http://localhost:5173" -ForegroundColor Yellow

# ---- Stage 4: mobile - LAST, FOREGROUND, so the Expo QR code is visible ---------
Show-Banner 'mobile' 'STARTING Expo/Metro on :8081 (last) - FOREGROUND so you see the QR code...'

if (-not (Test-Path (Join-Path $mobileDir 'node_modules'))) {
  Write-Host "[mobile] !! deps missing: run  cd mobile ; npm install" -ForegroundColor Red
  Stop-Jobs $jobs $bound
  exit 1
}

try {
  if ($TimeLimitSec -gt 0) {
    # Non-interactive path: keep mobile as a job + bounded streaming loop.
    $jobs['mobile'] = Start-Job -Name mobile -ArgumentList $mobileDir -ScriptBlock {
      param($wd)
      Set-Location $wd
      npx expo start
    }
    $deadline = (Get-Date).AddSeconds($TimeLimitSec)
    while ($true) {
      if ((Get-Date) -gt $deadline) {
        Write-Host "`n[time limit] -TimeLimitSec reached - stopping for non-interactive run" -ForegroundColor Yellow
        break
      }
      foreach ($key in @('mobile')) {
        $job = $jobs[$key]
        if ($job) { Drain-Job $job }
      }
      Start-Sleep -Milliseconds 300
    }
  } else {
    # Interactive path: run Expo in the foreground of THIS console = real TTY,
    # so `npx expo start` draws the QR code and accepts keys (a/w/r/q...).
    Write-Host "[mobile] Scan with Expo Go (Android / iOS) - keyboard: a=android w=web r=reload q=quit" -ForegroundColor $color.mobile
    Push-Location $mobileDir
    try {
      & npx expo start
    } catch {
      Write-Host "[mobile] !! expo exited with an error: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
      Pop-Location
    }
  }
} finally {
  # Reaching here means Expo quit / Ctrl+C / time limit - flush + stop the rest.
  foreach ($key in @('web', 'backend')) { Drain-Job $jobs[$key] }
  Stop-Jobs $jobs $bound
}