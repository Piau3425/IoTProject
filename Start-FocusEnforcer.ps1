# Focus Enforcer v1.0 - PowerShell Launcher
# This script starts both the backend and frontend servers
# Version: 1.1 - Improved cleanup logic to prevent orphan processes

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
$script:CleanupCompleted = $false

# Recursive function to get all descendant processes
function Get-ProcessDescendants {
    param([int]$ParentId)
    
    $descendants = @()
    $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $ParentId }
    
    foreach ($child in $children) {
        # First get grandchildren recursively
        $grandchildren = Get-ProcessDescendants -ParentId $child.ProcessId
        $descendants += $grandchildren
        # Then add the child itself (process children first, then parent)
        $descendants += $child
    }
    
    return $descendants
}

# Cleanup function - ensures all child processes are terminated
function Stop-AllServers {
    # Prevent multiple cleanup calls
    if ($script:CleanupCompleted) {
        return
    }
    $script:CleanupCompleted = $true
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  Stopping All Services..." -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Stop Backend and all its descendants
    if ($script:BackendJob) {
        Write-Host "[1/3] Stopping Backend (PID: $($script:BackendJob.Id))..." -ForegroundColor Yellow
        
        # Get all descendant processes recursively
        $backendDescendants = Get-ProcessDescendants -ParentId $script:BackendJob.Id
        foreach ($descendant in $backendDescendants) {
            try {
                Stop-Process -Id $descendant.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "      Stopped descendant process $($descendant.ProcessId) ($($descendant.Name))" -ForegroundColor Gray
            } catch { }
        }
        
        # Stop the PowerShell process itself
        try {
            if (-not $script:BackendJob.HasExited) {
                Stop-Process -Id $script:BackendJob.Id -Force -ErrorAction SilentlyContinue
            }
        } catch { }
        Write-Host "      Backend stopped" -ForegroundColor Green
    }
    
    # Stop Frontend and all its descendants
    if ($script:FrontendJob) {
        Write-Host "[2/3] Stopping Frontend (PID: $($script:FrontendJob.Id))..." -ForegroundColor Yellow
        
        # Get all descendant processes recursively
        $frontendDescendants = Get-ProcessDescendants -ParentId $script:FrontendJob.Id
        foreach ($descendant in $frontendDescendants) {
            try {
                Stop-Process -Id $descendant.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "      Stopped descendant process $($descendant.ProcessId) ($($descendant.Name))" -ForegroundColor Gray
            } catch { }
        }
        
        # Stop the PowerShell process itself
        try {
            if (-not $script:FrontendJob.HasExited) {
                Stop-Process -Id $script:FrontendJob.Id -Force -ErrorAction SilentlyContinue
            }
        } catch { }
        Write-Host "      Frontend stopped" -ForegroundColor Green
    }
    
    # Force kill any remaining processes on the ports (safety net)
    Write-Host "[3/3] Cleaning up port 8000 and 5173..." -ForegroundColor Yellow
    
    # Kill all Python processes that might be left over
    $pythonProcs = Get-Process python* -ErrorAction SilentlyContinue
    foreach ($proc in $pythonProcs) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "      Stopped Python process $($proc.Id)" -ForegroundColor Gray
        } catch { }
    }
    
    # Kill any node processes on port 5173
    $connections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
    $killedPids = @{}
    foreach ($conn in $connections) {
        if (-not $killedPids.ContainsKey($conn.OwningProcess)) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    Write-Host "      Stopped process $($proc.Id) ($($proc.Name)) on port $($conn.LocalPort)" -ForegroundColor Gray
                    $killedPids[$conn.OwningProcess] = $true
                } catch { }
            }
        }
    }
    
    # Final verification
    Start-Sleep -Milliseconds 500
    $remainingConnections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($remainingConnections) {
        Write-Host ""
        Write-Host "  Warning: Some processes may still be running on ports." -ForegroundColor Yellow
        Write-Host "  Run 'Get-NetTCPConnection -LocalPort 8000,5173' to check." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  All Services Stopped Successfully" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
}

# Clean up any existing processes on the ports before starting
Write-Host "Checking for existing processes on ports 8000 and 5173..." -ForegroundColor Gray
$existingConnections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
if ($existingConnections) {
    Write-Host "Found existing processes, cleaning up..." -ForegroundColor Yellow
    foreach ($conn in $existingConnections) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped existing process $($proc.Id) ($($proc.Name)) on port $($conn.LocalPort)" -ForegroundColor Gray
        }
    }
    Start-Sleep -Seconds 1
}

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
Write-Host "  Press Ctrl+C or close this window to stop..." -ForegroundColor Yellow
Write-Host ""

# Main loop with proper Ctrl+C handling
try {
    # Using a loop that's interruptible by Ctrl+C
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if child processes are still running
        $backendExited = $script:BackendJob.HasExited
        $frontendExited = $script:FrontendJob.HasExited
        
        if ($backendExited -or $frontendExited) {
            Write-Host ""
            if ($backendExited) {
                Write-Host "Backend service exited unexpectedly." -ForegroundColor Red
            }
            if ($frontendExited) {
                Write-Host "Frontend service exited unexpectedly." -ForegroundColor Red
            }
            break
        }
    }
}
finally {
    # This will ALWAYS run, even on Ctrl+C
    Stop-AllServers
}
