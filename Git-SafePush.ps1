# Safe Git Push Script
# Comprehensive security checks before commit and push

param(
    [Parameter(Mandatory=$true, HelpMessage="Enter commit message")]
    [string]$Message,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipCheck = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoPush = $false
)

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    switch ($Type) {
        "Success" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[X] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[!] $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[i] $Message" -ForegroundColor Cyan }
        default   { Write-Host $Message }
    }
}

$sensitivePatterns = @(
    "credentials.json",
    "*.key",
    "*.pem",
    "*.env",
    ".env.local",
    "*password*",
    "*secret*",
    "*token*",
    "browser_contexts/",
    "hostage_evidence/"
)

$requiredIgnorePatterns = @(
    "backend/credentials.json",
    "backend/browser_contexts/",
    "backend/hostage_evidence/",
    ".env",
    "*.key",
    "*.pem"
)

Write-ColorOutput "Safe Git Push Process..." "Info"
Write-Host ""

# Check if in git repository
if (-not (Test-Path ".git")) {
    Write-ColorOutput "Not in a Git repository!" "Error"
    exit 1
}

# Security checks
if (-not $SkipCheck) {
    Write-ColorOutput "Running security checks..." "Info"
    $hasIssues = $false
    
    # Check .gitignore
    if (-not (Test-Path ".gitignore")) {
        Write-ColorOutput ".gitignore file does not exist!" "Error"
        $hasIssues = $true
    } else {
        $gitignoreContent = Get-Content ".gitignore" -Raw
        $missingPatterns = @()
        
        foreach ($pattern in $requiredIgnorePatterns) {
            if ($gitignoreContent -notmatch [regex]::Escape($pattern)) {
                $missingPatterns += $pattern
            }
        }
        
        if ($missingPatterns.Count -gt 0) {
            Write-ColorOutput ".gitignore missing sensitive items:" "Warning"
            foreach ($pattern in $missingPatterns) {
                Write-Host "  - $pattern" -ForegroundColor Yellow
            }
            $hasIssues = $true
        } else {
            Write-ColorOutput ".gitignore configured correctly" "Success"
        }
    }
    
    # Check staged files
    Write-ColorOutput "Checking staged files..." "Info"
    $stagedFiles = git diff --cached --name-only
    
    if ($stagedFiles) {
        $dangerousFiles = @()
        
        foreach ($file in $stagedFiles) {
            foreach ($pattern in $sensitivePatterns) {
                if ($file -like $pattern -or $file -match $pattern) {
                    $dangerousFiles += $file
                    break
                }
            }
        }
        
        if ($dangerousFiles.Count -gt 0) {
            Write-ColorOutput "WARNING! Sensitive files in staging area:" "Error"
            foreach ($file in $dangerousFiles) {
                Write-Host "  - $file" -ForegroundColor Red
            }
            Write-ColorOutput "These files should not be committed!" "Error"
            $hasIssues = $true
        } else {
            Write-ColorOutput "Staged files check passed" "Success"
        }
    }
    
    # Check tracked files
    Write-ColorOutput "Checking repository..." "Info"
    $trackedSensitive = @()
    $allTrackedFiles = git ls-files
    
    foreach ($file in $allTrackedFiles) {
        foreach ($pattern in $sensitivePatterns) {
            if ($file -like $pattern -or $file -match $pattern) {
                $trackedSensitive += $file
                break
            }
        }
    }
    
    if ($trackedSensitive.Count -gt 0) {
        Write-ColorOutput "WARNING! Sensitive files in repository:" "Error"
        foreach ($file in $trackedSensitive) {
            Write-Host "  - $file" -ForegroundColor Red
        }
        Write-ColorOutput "Recommend: git rm --cached <file>" "Warning"
        $hasIssues = $true
    } else {
        Write-ColorOutput "Repository check passed" "Success"
    }
    
    Write-Host ""
    
    if ($hasIssues) {
        Write-ColorOutput "Security issues found!" "Error"
        $response = Read-Host "Continue anyway? (yes/no)"
        if ($response -ne "yes") {
            Write-ColorOutput "Operation cancelled" "Info"
            exit 1
        }
    }
} else {
    Write-ColorOutput "Security check skipped" "Warning"
}

# Git Add
Write-Host ""
Write-ColorOutput "Adding changes to staging area..." "Info"
git status --short

Write-Host ""
$addResponse = Read-Host "Add all changes? (yes/no/select)"

if ($addResponse -eq "select") {
    Write-ColorOutput "Use 'git add <file>' to manually select files" "Info"
    Write-ColorOutput "Then run this script again" "Info"
    exit 0
} elseif ($addResponse -eq "yes") {
    git add .
    Write-ColorOutput "All changes added" "Success"
} else {
    Write-ColorOutput "Operation cancelled" "Info"
    exit 0
}

# Git Commit
Write-Host ""
Write-ColorOutput "Creating commit..." "Info"
git commit -m $Message

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Commit failed!" "Error"
    exit 1
}

Write-ColorOutput "Commit successful!" "Success"

# Git Push
if (-not $NoPush) {
    Write-Host ""
    Write-ColorOutput "Preparing to push..." "Info"
    
    $currentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan
    
    $pushResponse = Read-Host "Confirm push? (yes/no)"
    
    if ($pushResponse -eq "yes") {
        git push origin $currentBranch
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Push successful!" "Success"
        } else {
            Write-ColorOutput "Push failed! Check network and permissions" "Error"
            exit 1
        }
    } else {
        Write-ColorOutput "Push cancelled (commit completed)" "Warning"
    }
} else {
    Write-ColorOutput "Push skipped (using -NoPush)" "Info"
}

Write-Host ""
Write-ColorOutput "Complete!" "Success"
