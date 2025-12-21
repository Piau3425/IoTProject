# Focus Enforcer v1.0 - PowerShell Launcher
# This script starts both the backend and frontend servers

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer v1.0 - System Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"

# Check Python installation
Write-Host "[CHECK] Verifying Python installation..." -ForegroundColor Gray
try {
    $pythonVersion = python --version 2>&1
    Write-Host "        Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found! Please install Python 3.8 or higher." -ForegroundColor Red
    Write-Host "        Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Node.js installation
Write-Host "[CHECK] Verifying Node.js installation..." -ForegroundColor Gray
try {
    $nodeVersion = node --version 2>&1
    Write-Host "        Found: Node $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found! Please install Node.js 18 or higher." -ForegroundColor Red
    Write-Host "        Download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if backend venv exists
Write-Host "[CHECK] Verifying backend virtual environment..." -ForegroundColor Gray
$VenvPath = Join-Path $BackendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $VenvPath)) {
    Write-Host "[SETUP] Creating Python virtual environment..." -ForegroundColor Yellow
    Push-Location $BackendPath
    try {
        python -m venv venv
        Write-Host "        Virtual environment created successfully" -ForegroundColor Green
        
        # Install requirements
        Write-Host "[SETUP] Installing Python dependencies..." -ForegroundColor Yellow
        & "$BackendPath\venv\Scripts\python.exe" -m pip install --upgrade pip
        & "$BackendPath\venv\Scripts\pip.exe" install -r requirements.txt
        Write-Host "        Dependencies installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to create virtual environment: $_" -ForegroundColor Red
        Pop-Location
        Read-Host "Press Enter to exit"
        exit 1
    }
    Pop-Location
} else {
    Write-Host "        Virtual environment found" -ForegroundColor Green
}

# Check Playwright browsers
Write-Host "[CHECK] Verifying Playwright browsers..." -ForegroundColor Gray
$PlaywrightCheck = & "$BackendPath\venv\Scripts\python.exe" -c "import playwright; print('OK')" 2>&1
if ($PlaywrightCheck -notlike "*OK*") {
    Write-Host "[SETUP] Installing Playwright browsers..." -ForegroundColor Yellow
    & "$BackendPath\venv\Scripts\playwright.exe" install chromium
}

# Check if node_modules exists
Write-Host "[CHECK] Verifying frontend dependencies..." -ForegroundColor Gray
$NodeModulesPath = Join-Path $FrontendPath "node_modules"
if (-not (Test-Path $NodeModulesPath)) {
    Write-Host "[SETUP] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $FrontendPath
    try {
        npm install
        Write-Host "        Dependencies installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to install frontend dependencies: $_" -ForegroundColor Red
        Pop-Location
        Read-Host "Press Enter to exit"
        exit 1
    }
    Pop-Location
} else {
    Write-Host "        Dependencies found" -ForegroundColor Green
}

# Check if .env exists in backend
$EnvPath = Join-Path $BackendPath ".env"
$EnvExamplePath = Join-Path $BackendPath ".env.example"
if (-not (Test-Path $EnvPath) -and (Test-Path $EnvExamplePath)) {
    Write-Host "[SETUP] Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item $EnvExamplePath $EnvPath
    Write-Host "        Please edit backend/.env to configure your settings" -ForegroundColor Yellow
}

# Check if credentials.json exists
$CredPath = Join-Path $BackendPath "credentials.json"
$CredExamplePath = Join-Path $BackendPath "credentials.example.json"
if (-not (Test-Path $CredPath) -and (Test-Path $CredExamplePath)) {
    Write-Host "[SETUP] Creating credentials.json from template..." -ForegroundColor Yellow
    Copy-Item $CredExamplePath $CredPath
}

# Check port availability
Write-Host "[CHECK] Checking port availability..." -ForegroundColor Gray
$BackendPort = 8000
$FrontendPort = 5173
$PortInUse = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue
if ($PortInUse) {
    Write-Host "[WARNING] Port $BackendPort is already in use!" -ForegroundColor Yellow
    Write-Host "          Backend may fail to start. Close the application using this port." -ForegroundColor Yellow
}
$PortInUse = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue
if ($PortInUse) {
    Write-Host "[WARNING] Port $FrontendPort is already in use!" -ForegroundColor Yellow
    Write-Host "          Frontend may fail to start. Close the application using this port." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
$BackendJob = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendPath'; & '$VenvPath'; python run.py" -PassThru

# Wait for backend to initialize
Write-Host "      Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Verify backend is running
try {
    $BackendCheck = Invoke-WebRequest -Uri "http://localhost:8000/api/hardware/status" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "      Backend is ready" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Backend may not have started correctly" -ForegroundColor Yellow
}

# Start Frontend
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
$FrontendJob = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendPath'; npm run dev" -PassThru

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  System Started Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Note: Backend and Frontend are running in separate windows" -ForegroundColor Gray
Write-Host ""

# Open browser after a short delay
Start-Sleep -Seconds 3
try {
    Start-Process "http://localhost:5173"
} catch {
    Write-Host "[WARNING] Could not open browser automatically" -ForegroundColor Yellow
}

Write-Host "  Press Ctrl+C or close this window to stop the system..." -ForegroundColor Yellow
Write-Host "  (Backend and Frontend windows will remain open)" -ForegroundColor Gray
Write-Host ""

# Wait for user interrupt
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    
    # Kill processes and their children
    if ($BackendJob -and -not $BackendJob.HasExited) {
        Write-Host "  Stopping backend..." -ForegroundColor Gray
        Stop-Process -Id $BackendJob.Id -Force -ErrorAction SilentlyContinue
    }
    if ($FrontendJob -and -not $FrontendJob.HasExited) {
        Write-Host "  Stopping frontend..." -ForegroundColor Gray
        Stop-Process -Id $FrontendJob.Id -Force -ErrorAction SilentlyContinue
    }
    
    # Kill any Python processes running uvicorn in this directory
    Get-WmiObject Win32_Process | Where-Object {
        $_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*$BackendPath*"
    } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    
    # Kill any Node processes running vite in this directory
    Get-WmiObject Win32_Process | Where-Object {
        $_.CommandLine -like "*vite*" -and $_.CommandLine -like "*$FrontendPath*"
    } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "System stopped." -ForegroundColor Green
}
