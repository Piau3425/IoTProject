# Focus Enforcer - Quick Start Guide

## 🚀 快速啟動 (Quick Start)

### 首次使用 (First Time Setup)

1. **執行環境設置**
   ```powershell
   # PowerShell (推薦)
   .\Setup.ps1
   
   # 或使用批次檔
   Setup.bat
   ```

2. **配置設定檔**
   - 編輯 `backend/.env` 設定系統參數
   - 編輯 `backend/credentials.json` 設定社交平台憑證（可選）

3. **啟動系統**
   ```powershell
   # PowerShell (推薦)
   .\Start-FocusEnforcer.ps1
   
   # 或使用批次檔
   start.bat
   ```

4. **開啟瀏覽器**
   - 前端介面：http://localhost:5173
   - 後端 API 文檔：http://localhost:8000/docs

---

## 📋 系統需求 (Requirements)

- **Python**: 3.8 或以上
- **Node.js**: 18 或以上
- **作業系統**: Windows 10/11

---

## 🔧 啟動方式比較

| 方式 | 檔案 | 優點 | 適用場景 |
|------|------|------|----------|
| **PowerShell 腳本** | `Start-FocusEnforcer.ps1` | ✅ 自動環境檢查<br>✅ 自動安裝依賴<br>✅ 完整錯誤處理<br>✅ 端口檢查 | **推薦** - 日常開發與使用 |
| **批次檔** | `start.bat` | ✅ 快速啟動<br>✅ 輕量級 | 環境已設置完成的快速啟動 |
| **手動啟動** | 分別啟動前後端 | ✅ 完全控制<br>✅ 方便除錯 | 開發與除錯 |

---

## 🛑 停止系統

### PowerShell 方式（推薦）
```powershell
.\Stop-FocusEnforcer.ps1
```

### 手動方式
- 關閉後端和前端的終端視窗
- 或在啟動腳本視窗按 `Ctrl+C`

---

## 🔨 手動啟動方式

### 啟動後端
```powershell
cd backend
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# 或
call venv\Scripts\activate.bat  # Windows CMD

python run.py
```

### 啟動前端（另開一個終端）
```powershell
cd frontend
npm run dev
```

---

## ⚙️ 配置說明

### 後端配置 (`backend/.env`)
```env
# 應用程式設定
DEBUG=True                    # 開發模式（會啟用 hot-reload）
HOST=0.0.0.0                  # 監聽位址
PORT=8000                     # 後端端口

# 硬體模擬模式
MOCK_HARDWARE=True            # True=使用模擬資料，False=連接實體硬體
```

### 社交平台憑證 (`backend/credentials.json`)
```json
{
  "gmail_user": "your-email@gmail.com",
  "gmail_app_password": "your-app-password",
  "threads_user_id": null,
  "threads_access_token": null,
  "discord_webhook_url": null
}
```

**取得 Gmail App Password:**
1. 前往 https://myaccount.google.com/security
2. 啟用兩步驟驗證
3. 前往「應用程式密碼」：https://myaccount.google.com/apppasswords
4. 產生新密碼，選擇「郵件」類別
5. 複製 16 位密碼（去除空格）

---

## 🐛 常見問題排解

### 問題：端口已被佔用
**解決方式：**
```powershell
# 找出佔用端口的程序
netstat -ano | findstr "8000"
netstat -ano | findstr "5173"

# 終止該程序（替換 PID）
taskkill /PID <PID> /F

# 或使用停止腳本
.\Stop-FocusEnforcer.ps1
```

### 問題：Python 套件安裝失敗
**解決方式：**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 問題：Playwright 瀏覽器未安裝
**解決方式：**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
playwright install chromium
```

### 問題：前端依賴安裝失敗
**解決方式：**
```powershell
cd frontend
rm -Recurse -Force node_modules
npm install
```

---

## 📁 專案結構

```
IoTProject/
├── Start-FocusEnforcer.ps1   # 主啟動腳本（推薦）
├── Setup.ps1                  # 環境設置腳本
├── Stop-FocusEnforcer.ps1     # 停止腳本
├── start.bat                  # 批次檔啟動腳本
├── Setup.bat                  # 批次檔設置腳本
├── backend/                   # Python FastAPI 後端
│   ├── run.py                # 後端入口
│   ├── requirements.txt      # Python 依賴
│   ├── .env                  # 環境變數配置
│   ├── credentials.json      # 社交平台憑證
│   └── app/                  # 應用程式源碼
├── frontend/                  # React + TypeScript 前端
│   ├── package.json          # Node 依賴
│   ├── vite.config.ts        # Vite 配置
│   └── src/                  # 前端源碼
├── src/                       # ESP8266 硬體韌體
│   └── main.cpp              # 韌體源碼
└── MARKDOWN/                  # 專案文件
    ├── OVERVIEW.md           # 專案概覽
    ├── SETUP.md              # 詳細設置指南
    ├── STRUCTURE.md          # 專案結構說明
    └── USAGE.md              # 使用說明
```

---

## 📖 詳細文件

- **專案概覽**: [MARKDOWN/OVERVIEW.md](MARKDOWN/OVERVIEW.md)
- **完整設置指南**: [MARKDOWN/SETUP.md](MARKDOWN/SETUP.md)
- **專案結構**: [MARKDOWN/STRUCTURE.md](MARKDOWN/STRUCTURE.md)
- **使用說明**: [MARKDOWN/USAGE.md](MARKDOWN/USAGE.md)
- **疑難排解**: [MARKDOWN/TROUBLESHOOTING.md](MARKDOWN/TROUBLESHOOTING.md) ⭐ 遇到問題先看這裡

---

## 🔗 相關連結

- **後端 API 文檔**: http://localhost:8000/docs
- **前端介面**: http://localhost:5173
- **WebSocket 連接**: ws://localhost:8000/socket.io/

---

## 💡 開發提示

1. **開發模式自動重載**
   - 後端：修改 Python 程式碼會自動重啟（需設定 `DEBUG=True`）
   - 前端：修改 React 程式碼會自動更新瀏覽器

2. **查看即時日誌**
   - 後端和前端會在各自的終端視窗顯示日誌
   - 可以保持視窗開啟以監控系統狀態

3. **模擬硬體模式**
   - 設定 `MOCK_HARDWARE=True` 可在沒有實體硬體的情況下測試系統
   - 在儀表板的「Dev Panel」可以手動控制模擬數據

---

**開發者**: Focus Enforcer Team  
**版本**: v1.0  
**最後更新**: 2025-12-21
