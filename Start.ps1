# Focus Enforcer - 快速啟動
# 後端先於前端 3 秒啟動

$BackendPath = Join-Path $PSScriptRoot "backend"
$FrontendPath = Join-Path $PSScriptRoot "frontend"
$VenvPath = Join-Path $BackendPath "venv\Scripts\Activate.ps1"

# 清理現有程序（確保 port 8000 和 5173 沒有佔用）
Write-Host "清理現有程序..." -ForegroundColor Yellow

# 方法 1: 透過 port 清理
$connections = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
foreach ($conn in $connections) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  已停止: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
    }
}

# 方法 2: 清理相關的 Python 和 Node 程序
Get-Process -Name "python", "node" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmdLine -match "run\.py|uvicorn|vite|5173") {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  已停止: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    }
}

# 等待確保程序完全結束
Start-Sleep -Milliseconds 500

# 再次確認 port 已釋放
$remaining = Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "[警告] 仍有程序佔用 port，強制終止..." -ForegroundColor Red
    foreach ($conn in $remaining) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "清理完成" -ForegroundColor Green

# 啟動後端
Write-Host "啟動後端..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; & '$VenvPath'; python run.py" -WindowStyle Minimized

# 等待 3 秒
Start-Sleep -Seconds 3

# 啟動前端
Write-Host "啟動前端..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npm run dev" -WindowStyle Minimized

Write-Host ""
Write-Host "後端:  http://localhost:8000" -ForegroundColor Green
Write-Host "前端:  http://localhost:5173" -ForegroundColor Green
