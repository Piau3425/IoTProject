# Focus Enforcer v1.0 - PowerShell Launcher
# This script starts both the backend and frontend servers

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Focus Enforcer v1.0 - System Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"
$VenvPath = Join-Path $BackendPath "venv\Scripts\Activate.ps1"

# Global variables for cleanup
$script:BackendJob = $null
$script:FrontendJob = $null

# Cleanup function
function Stop-AllServers {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  Stopping All Services..." -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Stop Backend
    if ($script:BackendJob -and -not $script:BackendJob.HasExited) {
        Write-Host "[1/2] Stopping Backend (PID: $($script:BackendJob.Id))..." -ForegroundColor Yellow
        
        # Find all child processes of the PowerShell process
        $backendChildren = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $script:BackendJob.Id }
        foreach ($child in $backendChildren) {
            Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "      Stopped child process $($child.ProcessId)" -ForegroundColor Gray
        }
        
        # Stop the PowerShell process itself
        Stop-Process -Id $script:BackendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "      Backend stopped" -ForegroundColor Green
    }
    
    # Stop Frontend
    if ($script:FrontendJob -and -not $script:FrontendJob.HasExited) {
        Write-Host "[2/2] Stopping Frontend (PID: $($script:FrontendJob.Id))..." -ForegroundColor Yellow
        
        # Find all child processes of the PowerShell process
        $frontendChildren = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $script:FrontendJob.Id }
        foreach ($child in $frontendChildren) {
            Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "      Stopped child process $($child.ProcessId)" -ForegroundColor Gray
        }
        
        # Stop the PowerShell process itself
        Stop-Process -Id $script:FrontendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "      Frontend stopped" -ForegroundColor Green
    }
    
    # Also kill any processes on the default ports
    Write-Host ""
    Write-Host "Checking for processes on ports 8000 and 5173..." -ForegroundColor Yellow
    $connections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process $($proc.Id) ($($proc.Name)) on port $($conn.LocalPort)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  All Services Stopped Successfully" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
}

# Register cleanup on Ctrl+C
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Stop-AllServers }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
$script:BackendJob = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendPath'; & '$VenvPath'; python run.py" -PassThru -WindowStyle Minimized

Write-Host "      Backend started (PID: $($script:BackendJob.Id))" -ForegroundColor Green
Write-Host "      Waiting 5 seconds before starting frontend..." -ForegroundColor Gray

# Wait 5 seconds before starting frontend
Start-Sleep -Seconds 5

# Start Frontend
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
$script:FrontendJob = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendPath'; npm run dev" -PassThru -WindowStyle Minimized

Write-Host "      Frontend started (PID: $($script:FrontendJob.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  System Started Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop the system..." -ForegroundColor Yellow
Write-Host ""

# Wait for user interrupt
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if child processes are still running
        if ($script:BackendJob.HasExited -or $script:FrontendJob.HasExited) {
            Write-Host ""
            Write-Host "One or more services exited unexpectedly." -ForegroundColor Red
            break
        }
    }
} catch {
    # Handle exceptions
    Write-Host ""
    Write-Host "Exception caught: $_" -ForegroundColor Red
} finally {
    Stop-AllServers
}
