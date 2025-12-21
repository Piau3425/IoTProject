# Git 推送工具使用說明

## 快速開始

### 方法 1：快速推送（推薦）

```powershell
.\Git-QuickPush.ps1
```

互動式操作，會自動檢查安全性，然後引導你完成 commit 和 push。

### 方法 2：完整功能

```powershell
# 基本使用
.\Git-SafePush.ps1 -Message "你的 commit 訊息"

# 只 commit，不 push
.\Git-SafePush.ps1 -Message "你的 commit 訊息" -NoPush
```

### 方法 3：僅檢查安全

```powershell
.\Check-GitSecurity.ps1
```

只檢查是否有敏感資料，不執行任何 git 操作。

## 保護的敏感資料

以下檔案已被 .gitignore 保護，**不會上傳到 GitHub**：

- ✅ `backend/credentials.json` - 包含密碼和 token
- ✅ `backend/browser_contexts/` - 瀏覽器狀態
- ✅ `backend/hostage_evidence/` - 上傳的圖片
- ✅ `.env` - 環境變數
- ✅ `*.key, *.pem` - 密鑰檔案

## 緊急：移除已追蹤的敏感檔案

如果敏感檔案已經被 git 追蹤：

```powershell
# 從 git 移除但保留本地檔案
git rm --cached backend/credentials.json

# Commit 這個變更
git commit -m "Remove sensitive file"

# 推送
git push
```

## 測試結果

剛才的檢查顯示：
- ✅ .gitignore 設定正確
- ✅ 沒有敏感檔案在 staging area
- ✅ 沒有敏感檔案在 repository 中
- ✅ 本地敏感檔案已被保護

你的專案是安全的！可以放心推送。

## 完整文檔

詳細說明請參考：[GIT_SECURITY_README.md](GIT_SECURITY_README.md)
