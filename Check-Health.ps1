# Focus Enforcer - Health Check Script
# This script checks if all services are running correctly

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer - Health Check" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$AllHealthy = $true

# Check Backend
Write-Host "[1/2] Checking Backend Server..." -ForegroundColor Yellow
try {
    $BackendResponse = Invoke-WebRequest -Uri "http://localhost:8000/api/hardware/status" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($BackendResponse.StatusCode -eq 200) {
        Write-Host "      ✓ Backend is running (Port 8000)" -ForegroundColor Green
        
        # Parse response to check status
        $BackendData = $BackendResponse.Content | ConvertFrom-Json
        Write-Host "      - Mock Mode: $($BackendData.mock_mode)" -ForegroundColor Gray
        Write-Host "      - Connected Clients: $($BackendData.connected_clients)" -ForegroundColor Gray
    }
} catch {
    Write-Host "      ✗ Backend is NOT running or not responding" -ForegroundColor Red
    Write-Host "        Expected URL: http://localhost:8000" -ForegroundColor Gray
    $AllHealthy = $false
}

# Check Frontend
Write-Host "[2/2] Checking Frontend Server..." -ForegroundColor Yellow
try {
    $FrontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($FrontendResponse.StatusCode -eq 200) {
        Write-Host "      ✓ Frontend is running (Port 5173)" -ForegroundColor Green
    }
} catch {
    Write-Host "      ✗ Frontend is NOT running or not responding" -ForegroundColor Red
    Write-Host "        Expected URL: http://localhost:5173" -ForegroundColor Gray
    $AllHealthy = $false
}

# Check Ports
Write-Host ""
Write-Host "Port Status:" -ForegroundColor Yellow
$Ports = @(8000, 5173)
foreach ($Port in $Ports) {
    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        $Process = Get-Process -Id $Connection.OwningProcess -ErrorAction SilentlyContinue
        if ($Process) {
            Write-Host "  Port $Port`: In use by $($Process.ProcessName) (PID: $($Process.Id))" -ForegroundColor Gray
        } else {
            Write-Host "  Port $Port`: In use" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Port $Port`: Available (not in use)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor $(if ($AllHealthy) { "Green" } else { "Red" })
if ($AllHealthy) {
    Write-Host "  All Services Running ✓" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor White
    Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Cyan
    Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
} else {
    Write-Host "  Some Services Not Running ✗" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start services, run:" -ForegroundColor Yellow
    Write-Host "  .\Start-FocusEnforcer.ps1" -ForegroundColor White
}
Write-Host ""
