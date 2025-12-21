# Git Remote Setup Helper
# Help configure origin remote

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Git Remote Configuration Tool" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check current remotes
Write-Host "[1] Current Remote Configuration:" -ForegroundColor Yellow
$remotes = git remote -v
if ([string]::IsNullOrWhiteSpace($remotes)) {
    Write-Host "   No remotes configured" -ForegroundColor Red
} else {
    Write-Host $remotes -ForegroundColor Green
}

Write-Host ""
Write-Host "[2] Configure Origin Remote:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Example GitHub URL:" -ForegroundColor Cyan
Write-Host "  - HTTPS: https://github.com/username/repository.git" -ForegroundColor Cyan
Write-Host "  - SSH:   git@github.com:username/repository.git" -ForegroundColor Cyan
Write-Host ""

$url = Read-Host "Enter your repository URL"

if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Host "[X] URL cannot be empty" -ForegroundColor Red
    exit 1
}

# Check if origin already exists
$existingOrigin = git config --get remote.origin.url
if ($null -ne $existingOrigin) {
    Write-Host ""
    Write-Host "[!] Origin already exists: $existingOrigin" -ForegroundColor Yellow
    $replace = Read-Host "Replace it? (yes/no)"
    
    if ($replace -ne "yes") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    git remote remove origin
    Write-Host "[OK] Removed existing origin" -ForegroundColor Green
}

# Add origin
Write-Host ""
Write-Host "[3] Adding origin..." -ForegroundColor Yellow

git remote add origin $url

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Origin configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New configuration:" -ForegroundColor Cyan
    git remote -v
} else {
    Write-Host "[X] Failed to add origin" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4] Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run: git fetch origin" -ForegroundColor Cyan
Write-Host "   2. Run: git branch -u origin/master master" -ForegroundColor Cyan
Write-Host "   3. Or use: .\Git-QuickPush.ps1" -ForegroundColor Cyan
Write-Host ""

# Optional: Check connectivity
$checkConnection = Read-Host "Test connection to repository? (yes/no)"
if ($checkConnection -eq "yes") {
    Write-Host ""
    Write-Host "[*] Testing connection..." -ForegroundColor Yellow
    
    git ls-remote origin HEAD
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Connection successful!" -ForegroundColor Green
    } else {
        Write-Host "[!] Connection test failed - check your credentials" -ForegroundColor Yellow
    }
}

Write-Host ""
