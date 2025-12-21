# Quick Git Push Script
# Interactive commit and push with security checks

# Check if in git repository
if (-not (Test-Path ".git")) {
    Write-Host "[X] Not in a Git repository" -ForegroundColor Red
    exit 1
}

# 1. Run security check
Write-Host "Security Check..." -ForegroundColor Cyan
& "$PSScriptRoot\Check-GitSecurity.ps1"

if ($LASTEXITCODE -ne 0) {
    $continue = Read-Host "`nSecurity issues found. Continue anyway? (yes/no)"
    if ($continue -ne "yes") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# 2. Show status
Write-Host "`nCurrent Status:" -ForegroundColor Cyan
git status --short

# 3. Add files
Write-Host ""
$addChoice = Read-Host "Add changes? (yes/no)"
if ($addChoice -ne "yes") {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

git add .
Write-Host "[OK] Changes added" -ForegroundColor Green

# 4. Commit
Write-Host ""
$commitMsg = Read-Host "Enter commit message"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    Write-Host "[X] Commit message cannot be empty" -ForegroundColor Red
    exit 1
}

git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Commit failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Commit successful" -ForegroundColor Green

# 5. Push
Write-Host ""
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan

$pushChoice = Read-Host "Push to remote? (yes/no)"
if ($pushChoice -eq "yes") {
    git push origin $currentBranch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[SUCCESS] Push completed!" -ForegroundColor Green
    } else {
        Write-Host "`n[X] Push failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[OK] Commit completed (not pushed)" -ForegroundColor Yellow
}
