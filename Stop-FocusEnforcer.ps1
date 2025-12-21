# Focus Enforcer - Stop Script
# This script stops all running servers

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer - Stopping Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"

# Find and kill backend processes
Write-Host "Stopping backend servers..." -ForegroundColor Yellow
$BackendProcesses = Get-WmiObject Win32_Process | Where-Object {
    ($_.CommandLine -like "*uvicorn*" -or $_.CommandLine -like "*python*run.py*") -and 
    $_.CommandLine -like "*$BackendPath*"
}

if ($BackendProcesses) {
    foreach ($proc in $BackendProcesses) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped process $($proc.ProcessId)" -ForegroundColor Gray
    }
    Write-Host "  Backend stopped" -ForegroundColor Green
} else {
    Write-Host "  No backend processes found" -ForegroundColor Gray
}

# Find and kill frontend processes
Write-Host "Stopping frontend servers..." -ForegroundColor Yellow
$FrontendProcesses = Get-WmiObject Win32_Process | Where-Object {
    ($_.CommandLine -like "*vite*" -or $_.CommandLine -like "*npm*run*dev*") -and 
    $_.CommandLine -like "*$FrontendPath*"
}

if ($FrontendProcesses) {
    foreach ($proc in $FrontendProcesses) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped process $($proc.ProcessId)" -ForegroundColor Gray
    }
    Write-Host "  Frontend stopped" -ForegroundColor Green
} else {
    Write-Host "  No frontend processes found" -ForegroundColor Gray
}

# Kill any processes using the default ports
Write-Host "Checking default ports..." -ForegroundColor Yellow
$Connections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
if ($Connections) {
    foreach ($conn in $Connections) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process $($proc.Id) on port $($conn.LocalPort)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  All services stopped" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
