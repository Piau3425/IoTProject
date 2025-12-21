# Focus Enforcer - Setup Script
# This script sets up the development environment

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer - Environment Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"

# Check Python
Write-Host "[1/6] Checking Python..." -ForegroundColor Green
try {
    $pythonVersion = python --version 2>&1
    Write-Host "      Found: $pythonVersion" -ForegroundColor White
} catch {
    Write-Host "[ERROR] Python not found! Please install Python 3.8+" -ForegroundColor Red
    Write-Host "        Download: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js
Write-Host "[2/6] Checking Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    Write-Host "      Found: Node $nodeVersion, npm $npmVersion" -ForegroundColor White
} catch {
    Write-Host "[ERROR] Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    Write-Host "        Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Create Python virtual environment
Write-Host "[3/6] Setting up Python virtual environment..." -ForegroundColor Green
Push-Location $BackendPath
if (Test-Path "venv") {
    Write-Host "      Virtual environment already exists" -ForegroundColor Gray
} else {
    python -m venv venv
    Write-Host "      Virtual environment created" -ForegroundColor White
}

# Install Python dependencies
Write-Host "[4/6] Installing Python dependencies..." -ForegroundColor Green
& "venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-Host "      Python packages installed" -ForegroundColor White

# Install Playwright browsers
Write-Host "      Installing Playwright browsers (Chromium)..." -ForegroundColor Gray
& "venv\Scripts\playwright.exe" install chromium --quiet
Write-Host "      Playwright browsers installed" -ForegroundColor White

Pop-Location

# Install frontend dependencies
Write-Host "[5/6] Installing frontend dependencies..." -ForegroundColor Green
Push-Location $FrontendPath
npm install --silent
Write-Host "      Node packages installed" -ForegroundColor White
Pop-Location

# Create config files
Write-Host "[6/6] Creating configuration files..." -ForegroundColor Green

# Copy .env.example to .env
$EnvPath = Join-Path $BackendPath ".env"
$EnvExamplePath = Join-Path $BackendPath ".env.example"
if (-not (Test-Path $EnvPath)) {
    Copy-Item $EnvExamplePath $EnvPath
    Write-Host "      Created .env file" -ForegroundColor White
    Write-Host "      [ACTION REQUIRED] Edit backend/.env to configure settings" -ForegroundColor Yellow
} else {
    Write-Host "      .env already exists" -ForegroundColor Gray
}

# Copy credentials.example.json to credentials.json
$CredPath = Join-Path $BackendPath "credentials.json"
$CredExamplePath = Join-Path $BackendPath "credentials.example.json"
if (-not (Test-Path $CredPath)) {
    Copy-Item $CredExamplePath $CredPath
    Write-Host "      Created credentials.json file" -ForegroundColor White
} else {
    Write-Host "      credentials.json already exists" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Edit backend/.env to configure your settings" -ForegroundColor Yellow
Write-Host "  2. Run .\Start-FocusEnforcer.ps1 to start the system" -ForegroundColor Yellow
Write-Host ""
Write-Host "For hardware setup, see MARKDOWN/SETUP.md" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
