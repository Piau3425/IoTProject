# 🛡️ THE FOCUS ENFORCER v1.0

**Zero-Trust Focus Monitoring with Social Shaming Enforcement**
**零信任專注監控與社交羞辱執法系統**

---

## 📖 專案文檔導覽 (Documentation)

本專案包含完整的技術文件，請參閱 `MARKDOWN/` 資料夾：

- **[專案總覽 (Overview)](MARKDOWN/OVERVIEW.md)**: 了解核心概念、功能與架構。
- **[安裝指南 (Setup)](MARKDOWN/SETUP.md)**: 從零開始的軟硬體建置教學。
- **[使用指南 (Usage)](MARKDOWN/USAGE.md)**: 儀表板操作與專注流程說明。
- **[專案結構 (Structure)](MARKDOWN/STRUCTURE.md)**: 檔案目錄與程式碼說明。
- **[通訊協定 (Socket)](MARKDOWN/SOCKET_COMMUNICATION.md)**: 前後端與硬體的通訊規格。
- **[疑難排解 (Troubleshooting)](MARKDOWN/TROUBLESHOOTING.md)**: 常見問題與解決方案。

---

## 🚀 快速啟動 (Quick Start)

### 1. 環境設置 (首次執行)
在 PowerShell 中執行：
```powershell
.\Setup.ps1
```

### 2. 啟動系統
一鍵啟動後端、前端與瀏覽器：
```powershell
.\Start-FocusEnforcer.ps1
```

### 3. 存取介面
- **儀表板**: [http://localhost:5173](http://localhost:5173)
- **API 文件**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ⚠️ 安全性警告 (Security Warning)

本專案包含 **Git 安全性機制**，防止憑證洩漏：
- 推送前請務必執行 `Git-SafePush.ps1`。
- 敏感資訊 (如 `credentials.json`) 已被 `.gitignore` 排除。
- 詳情請參閱 [GIT_SECURITY_README.md](GIT_SECURITY_README.md)。

---

## 🛠️ 技術堆疊 (Tech Stack)

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Python FastAPI, Socket.IO, Playwright
- **Hardware**: ESP8266 (Wemos D1 Mini), PlatformIO, C++
- **Sensors**: LD2410 (Radar), KY-033 (IR), PN532 (NFC), MAX9418 (Mic)
