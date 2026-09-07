# dev_up_all.ps1 - bring up backend + relay + emulator/adb plumbing after a reboot.
param([string]$Avd = "Pixel_10_Pro")

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backend = Join-Path $root 'backend'
$py = Join-Path $backend '.venv\Scripts\python.exe'
$relay = Join-Path $backend 'scripts\host_relay.py'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$em = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'

function Test-Port([int]$port) {
  (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) -ne $null
}

if (Test-Port 8000) { "backend: already running on :8000" }
elseif (Test-Path $py) {
  Start-Process -FilePath $py -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $backend -WindowStyle Hidden
  "backend: starting uvicorn on :8000"
}
else { "backend: python venv missing at $py - start manually" }

if (Test-Port 8090) { "relay: already running on :8090" }
elseif (Test-Path $py -and (Test-Path $relay)) {
  Start-Process -FilePath $py -ArgumentList ('"' + $relay + '"') -WorkingDirectory (Split-Path $relay) -WindowStyle Hidden
  "relay: starting host_relay.py on :8090"
}
else { "relay: skipped (python or host_relay.py missing)" }

if (Test-Path $adb) {
  if (-not ((& $adb devices) -join ' ' -match 'emulator-')) {
    if (Test-Path $em) {
      Start-Process -FilePath $em -ArgumentList "-avd $Avd -no-snapshot-load"
      "emulator: booting $Avd (waiting for boot)..."
      $done = $false
      for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 5
        $st = (& $adb shell getprop sys.boot_completed 2>$null) -join ''
        if ($st -match '1') { "emulator: booted after ~$($i*5 + 5)s"; $done = $true; break }
      }
      if (-not $done) { "emulator: not booted after 300s - check it manually" }
    }
    else { "emulator: not found at $em" }
  }
  else { "emulator: already attached" }

  & $adb reverse tcp:8081 tcp:8081
  & $adb reverse tcp:8090 tcp:8090
  & $adb reverse tcp:8000 tcp:8000
  "adb reverses:"; & $adb reverse --list
}
else { "adb: not found at $adb" }

"`nSummary:"
"  backend (uvicorn) on :8000, relay on :8090 -> :8000, adb reverses for 8081/8090/8000"
"  Metro    : cd mobile ; npx expo start -c   (start it in a terminal and keep it open)"
"  App URL  : exp://localhost:8081  (open in Expo Go once Metro is up)"