# Git 安全推送工具

這些腳本可幫助你安全地將代碼推送到 GitHub，並防止敏感資料外洩。

## 📋 腳本說明

### 1. **Check-GitSecurity.ps1** - 安全檢查工具
快速掃描並檢查敏感資料：
- ✅ 檢查 `.gitignore` 設定
- ✅ 掃描 staged files 中的敏感檔案
- ✅ 檢查 repository 中已追蹤的敏感檔案
- ✅ 列出被保護的本地敏感檔案

```powershell
.\Check-GitSecurity.ps1
```

### 2. **Git-QuickPush.ps1** - 快速推送（推薦）
互動式的 commit 和 push 流程：
- 自動執行安全檢查
- 顯示當前狀態
- 互動式選擇要 commit 的內容
- 確認後推送

```powershell
.\Git-QuickPush.ps1
```

### 3. **Git-SafePush.ps1** - 完整功能版
進階的 Git 推送工具，提供更多選項和詳細檢查：

```powershell
# 基本使用
.\Git-SafePush.ps1 -Message "Update feature"

# 只 commit 不 push
.\Git-SafePush.ps1 -Message "Fix bug" -NoPush

# 跳過安全檢查（不建議）
.\Git-SafePush.ps1 -Message "Quick fix" -SkipCheck
```

#### 參數說明：
- `-Message`: Commit 訊息（必填）
- `-NoPush`: 只執行 commit，不推送
- `-SkipCheck`: 跳過安全檢查（危險！不建議使用）

## 🔐 敏感資料保護

### 已保護的檔案類型

以下檔案已在 `.gitignore` 中設定，**不會**被上傳到 GitHub：

```
✅ backend/credentials.json          # 憑證資訊
✅ backend/browser_contexts/         # 瀏覽器狀態
✅ backend/hostage_evidence/         # 人質證據（圖片等）
✅ .env, .env.local                  # 環境變數
✅ *.key, *.pem                      # 密鑰檔案
✅ __pycache__/, *.pyc               # Python 快取
✅ node_modules/, dist/              # 前端依賴和建置檔案
```

### ⚠️ 重要提醒

1. **credentials.json** 包含：
   - Gmail 應用程式密碼
   - Threads access token
   - Discord webhook URL
   - **絕對不可上傳！**

2. **browser_contexts/** 包含：
   - 瀏覽器 session 資訊
   - 可能包含登入狀態

3. **hostage_evidence/** 包含：
   - 上傳的人質圖片
   - 個人隱私資料

## 🚀 使用流程

### 日常 Commit & Push（推薦）

```powershell
# 方法 1: 使用快速推送腳本（最簡單）
.\Git-QuickPush.ps1

# 方法 2: 使用完整功能版
.\Git-SafePush.ps1 -Message "Add new feature"
```

### 僅檢查安全性

```powershell
.\Check-GitSecurity.ps1
```

### 修復：移除已追蹤的敏感檔案

如果敏感檔案已經被 git 追蹤，需要移除：

```powershell
# 從 git 移除但保留本地檔案
git rm --cached backend/credentials.json

# Commit 這個變更
git commit -m "Remove sensitive file from tracking"

# 推送
git push
```

## 🛠️ 故障排除

### 問題 1: 敏感檔案已在 repository 中

**症狀**：檢查工具報告「發現敏感檔案已在 repository 中」

**解決方法**：
```powershell
# 1. 移除追蹤（但保留本地檔案）
git rm --cached path/to/sensitive/file

# 2. 確認 .gitignore 已包含該檔案
# 3. Commit 並推送
git commit -m "Stop tracking sensitive files"
git push
```

### 問題 2: .gitignore 不生效

**可能原因**：檔案已被追蹤

**解決方法**：
```powershell
# 清除快取重新追蹤
git rm -r --cached .
git add .
git commit -m "Fix .gitignore"
```

### 問題 3: 推送被拒絕

```powershell
# 先拉取遠端變更
git pull origin main

# 解決衝突（如果有）
# 然後重新推送
git push origin main
```

## 📖 範例使用情境

### 情境 1: 新增功能

```powershell
# 1. 修改程式碼...
# 2. 檢查安全性
.\Check-GitSecurity.ps1

# 3. 如果通過，使用快速推送
.\Git-QuickPush.ps1
# 輸入 commit 訊息: "Add sensor monitoring feature"
```

### 情境 2: 修復 Bug

```powershell
.\Git-SafePush.ps1 -Message "Fix: Resolve timer reset issue"
```

### 情境 3: 只想 Commit，稍後再 Push

```powershell
.\Git-SafePush.ps1 -Message "WIP: Implementing social media integration" -NoPush
```

## 🔍 安全檢查項目

每次推送前，腳本會自動檢查：

1. ✅ `.gitignore` 檔案是否存在
2. ✅ 必要的敏感模式是否在 `.gitignore` 中
3. ✅ Staged files 中是否有敏感檔案
4. ✅ Repository 中是否已追蹤敏感檔案
5. ✅ 列出被保護的本地敏感檔案（資訊性）

## 💡 最佳實踐

1. **每次推送前都執行檢查**
   ```powershell
   .\Check-GitSecurity.ps1
   ```

2. **使用有意義的 commit 訊息**
   - ❌ "update"
   - ❌ "fix"
   - ✅ "Add hardware status monitoring to dashboard"
   - ✅ "Fix: Resolve WebSocket connection timeout issue"

3. **定期檢查 `.gitignore`**
   - 新增敏感檔案時，記得更新 `.gitignore`

4. **不要使用 `-SkipCheck`**
   - 除非你完全知道自己在做什麼

5. **本地保留 credentials.example.json**
   - 作為設定範本
   - 不包含真實憑證

## 📝 快速參考

```powershell
# 快速檢查
.\Check-GitSecurity.ps1

# 快速推送（推薦新手）
.\Git-QuickPush.ps1

# 完整功能推送
.\Git-SafePush.ps1 -Message "Your message"

# 只 commit
.\Git-SafePush.ps1 -Message "Your message" -NoPush

# 移除敏感檔案追蹤
git rm --cached path/to/file
git commit -m "Stop tracking sensitive file"

# 查看當前狀態
git status

# 查看 staged files
git diff --cached --name-only
```

## ⚙️ 自訂設定

如需修改敏感檔案模式，編輯腳本中的 `$sensitivePatterns` 陣列：

```powershell
$sensitivePatterns = @(
    "credentials.json",
    "*.key",
    "*.pem",
    # 新增你的模式...
)
```

## 🆘 緊急情況

如果不小心推送了敏感資料：

1. **立即更改所有外洩的憑證**（Gmail 密碼、Token 等）
2. **從 Git 歷史中移除**：
   ```powershell
   # 使用 BFG Repo-Cleaner 或 git filter-branch
   # 這需要強制推送，會重寫歷史！
   ```
3. **聯絡 GitHub 支援**請求協助清除快取

---

**記住**：預防勝於治療！每次推送前都執行安全檢查。 🔒
