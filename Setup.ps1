# Focus Enforcer - 環境設置腳本
# 此腳本設置開發環境

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer - 環境設置" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"

# 檢查 Python
Write-Host "[1/6] 檢查 Python..." -ForegroundColor Green
try {
    $pythonVersion = python --version 2>&1
    Write-Host "      已找到: $pythonVersion" -ForegroundColor White
} catch {
    Write-Host "[錯誤] 未找到 Python！請安裝 Python 3.8+" -ForegroundColor Red
    Write-Host "        下載: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# 檢查 Node.js
Write-Host "[2/6] 檢查 Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    Write-Host "      已找到: Node $nodeVersion, npm $npmVersion" -ForegroundColor White
} catch {
    Write-Host "[錯誤] 未找到 Node.js！請安裝 Node.js 18+" -ForegroundColor Red
    Write-Host "        下載: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# 建立 Python 虛擬環境
Write-Host "[3/6] 設置 Python 虛擬環境..." -ForegroundColor Green
Push-Location $BackendPath
if (Test-Path "venv") {
    Write-Host "      虛擬環境已存在" -ForegroundColor Gray
} else {
    python -m venv venv
    Write-Host "      虛擬環境已建立" -ForegroundColor White
}

# 安裝 Python 依賴
Write-Host "[4/6] 安裝 Python 依賴..." -ForegroundColor Green
& "venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-Host "      Python 套件已安裝" -ForegroundColor White

# 安裝 Playwright 瀏覽器
Write-Host "      安裝 Playwright 瀏覽器 (Chromium)..." -ForegroundColor Gray
& "venv\Scripts\playwright.exe" install chromium --quiet
Write-Host "      Playwright 瀏覽器已安裝" -ForegroundColor White

Pop-Location

# 安裝前端依賴
Write-Host "[5/6] 安裝前端依賴..." -ForegroundColor Green
Push-Location $FrontendPath
npm install --silent
Write-Host "      Node 套件已安裝" -ForegroundColor White
Pop-Location

# 建立設定檔
Write-Host "[6/6] 建立設定檔..." -ForegroundColor Green

# 複製 .env.example 到 .env
$EnvPath = Join-Path $BackendPath ".env"
$EnvExamplePath = Join-Path $BackendPath ".env.example"
if (-not (Test-Path $EnvPath)) {
    Copy-Item $EnvExamplePath $EnvPath
    Write-Host "      已建立 .env 檔案" -ForegroundColor White
    Write-Host "      [需要操作] 編輯 backend/.env 以設定配置" -ForegroundColor Yellow
} else {
    Write-Host "      .env 已存在" -ForegroundColor Gray
}

# 複製 credentials.example.json 到 credentials.json
$CredPath = Join-Path $BackendPath "credentials.json"
$CredExamplePath = Join-Path $BackendPath "credentials.example.json"
if (-not (Test-Path $CredPath)) {
    Copy-Item $CredExamplePath $CredPath
    Write-Host "      已建立 credentials.json 檔案" -ForegroundColor White
} else {
    Write-Host "      credentials.json 已存在" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  設置完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：" -ForegroundColor White
Write-Host "  1. 編輯 backend/.env 以設定您的配置" -ForegroundColor Yellow
Write-Host "  2. 執行 .\Start.ps1 啟動系統" -ForegroundColor Yellow
Write-Host ""
Write-Host "硬體設置請參閱 MARKDOWN/SETUP.md" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 結束"
