# Git Security Check Script
# Scans repository for sensitive files and potential security issues

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Git Sensitive Data Check Tool" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if in git repository
if (-not (Test-Path ".git")) {
    Write-Host "[X] Not in a Git repository!" -ForegroundColor Red
    exit 1
}

# Define sensitive file patterns
$sensitivePatterns = @(
    "credentials.json",
    "*.key",
    "*.pem",
    "*.env",
    ".env.local",
    "*password*",
    "*secret*",
    "*token*",
    "browser_contexts/*",
    "hostage_evidence/*"
)

$issues = 0

# 1. Check .gitignore
Write-Host "[1] Checking .gitignore..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    Write-Host "   [OK] .gitignore exists" -ForegroundColor Green
    
    $gitignoreContent = Get-Content ".gitignore" -Raw
    $requiredPatterns = @(
        "credentials.json",
        "browser_contexts",
        "hostage_evidence",
        ".env",
        "*.key",
        "*.pem"
    )
    
    $missing = @()
    foreach ($pattern in $requiredPatterns) {
        if ($gitignoreContent -notmatch [regex]::Escape($pattern)) {
            $missing += $pattern
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "   [!] Missing sensitive patterns:" -ForegroundColor Yellow
        $missing | ForEach-Object { Write-Host "     - $_" -ForegroundColor Yellow }
        $issues++
    } else {
        Write-Host "   [OK] Sensitive patterns configured" -ForegroundColor Green
    }
} else {
    Write-Host "   [X] .gitignore does not exist!" -ForegroundColor Red
    $issues++
}

Write-Host ""

# 2. Check staged files
Write-Host "[2] Checking Staged Files..." -ForegroundColor Yellow
$stagedFiles = git diff --cached --name-only

if ($stagedFiles) {
    $dangerousStaged = @()
    foreach ($file in $stagedFiles) {
        foreach ($pattern in $sensitivePatterns) {
            if ($file -like $pattern -or $file -match $pattern.Replace('*', '.*')) {
                $dangerousStaged += $file
                break
            }
        }
    }
    
    if ($dangerousStaged.Count -gt 0) {
        Write-Host "   [X] Found sensitive files in staging area:" -ForegroundColor Red
        $dangerousStaged | ForEach-Object { Write-Host "     - $_" -ForegroundColor Red }
        $issues++
    } else {
        Write-Host "   [OK] Staged files are safe" -ForegroundColor Green
    }
} else {
    Write-Host "   [i] No staged files" -ForegroundColor Cyan
}

Write-Host ""

# 3. Check tracked sensitive files
Write-Host "[3] Checking Repository for Sensitive Files..." -ForegroundColor Yellow
$allTrackedFiles = git ls-files

$trackedSensitive = @()
foreach ($file in $allTrackedFiles) {
    foreach ($pattern in $sensitivePatterns) {
        if ($file -like $pattern -or $file -match $pattern.Replace('*', '.*')) {
            $trackedSensitive += $file
            break
        }
    }
}

if ($trackedSensitive.Count -gt 0) {
    Write-Host "   [X] Found sensitive files in repository:" -ForegroundColor Red
    $trackedSensitive | ForEach-Object { Write-Host "     - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "   Recommended action:" -ForegroundColor Yellow
    $trackedSensitive | ForEach-Object { 
        Write-Host "     git rm --cached `"$_`"" -ForegroundColor Yellow 
    }
    $issues++
} else {
    Write-Host "   [OK] No sensitive files in repository" -ForegroundColor Green
}

Write-Host ""

# 4. List protected files
Write-Host "[4] Checking Protected Files..." -ForegroundColor Yellow
$protectedFiles = @(
    "backend/credentials.json",
    "backend/browser_contexts/",
    "backend/hostage_evidence/",
    ".env",
    ".env.local"
)

$existingProtected = @()
foreach ($file in $protectedFiles) {
    if (Test-Path $file) {
        $existingProtected += $file
    }
}

if ($existingProtected.Count -gt 0) {
    Write-Host "   [i] Sensitive files exist and are protected:" -ForegroundColor Cyan
    $existingProtected | ForEach-Object { Write-Host "     - $_" -ForegroundColor Cyan }
} else {
    Write-Host "   [i] No local sensitive files found" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan

# Summary
if ($issues -eq 0) {
    Write-Host "[OK] Check complete: No security issues found" -ForegroundColor Green
} else {
    Write-Host "[X] Found $issues security issue(s), please fix before pushing" -ForegroundColor Red
    exit 1
}

Write-Host ""
