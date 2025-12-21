# 開發環境檢查清單 (Development Environment Checklist)

在開始開發或運行 Focus Enforcer 之前，請確保完成以下檢查項目。

---

## ✅ 系統需求檢查

### 必需軟體

- [ ] **Python 3.8+** 已安裝
  ```powershell
  python --version
  # 應顯示: Python 3.8.x 或更高
  ```

- [ ] **Node.js 18+** 已安裝
  ```powershell
  node --version
  # 應顯示: v18.x.x 或更高
  ```

- [ ] **npm** 已安裝
  ```powershell
  npm --version
  # 應顯示: 9.x.x 或更高
  ```

### 可選軟體

- [ ] **Git** (用於版本控制)
- [ ] **VS Code** (推薦的開發環境)
- [ ] **PlatformIO** (用於 ESP8266 開發)

---

## ✅ 專案結構檢查

### 根目錄必需檔案

- [ ] `Start-FocusEnforcer.ps1` 存在
- [ ] `Setup.ps1` 存在
- [ ] `README.md` 存在
- [ ] `package.json` 存在

### 後端目錄

- [ ] `backend/` 目錄存在
- [ ] `backend/requirements.txt` 存在
- [ ] `backend/run.py` 存在
- [ ] `backend/.env.example` 存在
- [ ] `backend/credentials.example.json` 存在

### 前端目錄

- [ ] `frontend/` 目錄存在
- [ ] `frontend/package.json` 存在
- [ ] `frontend/vite.config.ts` 存在
- [ ] `frontend/src/` 目錄存在

---

## ✅ 環境配置檢查

### Python 虛擬環境

- [ ] `backend/venv/` 目錄存在
  ```powershell
  Test-Path backend/venv
  ```

- [ ] 虛擬環境可以啟動
  ```powershell
  cd backend
  .\venv\Scripts\Activate.ps1
  ```

- [ ] Python 套件已安裝
  ```powershell
  pip list | Select-String "fastapi|uvicorn|socketio|playwright"
  ```

- [ ] Playwright 瀏覽器已安裝
  ```powershell
  playwright --version
  ```

### Node.js 依賴

- [ ] `frontend/node_modules/` 目錄存在
  ```powershell
  Test-Path frontend/node_modules
  ```

- [ ] 前端套件已安裝
  ```powershell
  cd frontend
  npm list --depth=0
  ```

---

## ✅ 配置檔案檢查

### 後端配置

- [ ] `backend/.env` 檔案存在
  - 如果不存在，從 `.env.example` 複製：
    ```powershell
    Copy-Item backend/.env.example backend/.env
    ```

- [ ] `.env` 檔案已正確配置：
  - [ ] `DEBUG=True` (開發模式)
  - [ ] `HOST=0.0.0.0`
  - [ ] `PORT=8000`
  - [ ] `MOCK_HARDWARE=True` (如果沒有實體硬體)

- [ ] `backend/credentials.json` 檔案存在
  - 如果不存在，從 `credentials.example.json` 複製：
    ```powershell
    Copy-Item backend/credentials.example.json backend/credentials.json
    ```

### 前端配置

- [ ] `frontend/vite.config.ts` 配置正確
  - [ ] Proxy 設定指向 `http://localhost:8000`
  - [ ] Port 設定為 `5173`

---

## ✅ 網路與端口檢查

### 端口可用性

- [ ] 端口 8000 未被佔用（後端）
  ```powershell
  Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
  # 應該沒有輸出，或執行 .\Stop-FocusEnforcer.ps1
  ```

- [ ] 端口 5173 未被佔用（前端）
  ```powershell
  Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
  # 應該沒有輸出
  ```

### 防火牆設定

- [ ] Windows 防火牆允許 Python 通過
- [ ] Windows 防火牆允許 Node 通過

---

## ✅ 服務啟動檢查

### 啟動測試

- [ ] 後端可以成功啟動
  ```powershell
  cd backend
  .\venv\Scripts\Activate.ps1
  python run.py
  # 應該看到啟動訊息，無錯誤
  # Ctrl+C 停止
  ```

- [ ] 前端可以成功啟動
  ```powershell
  cd frontend
  npm run dev
  # 應該看到 Vite 啟動訊息
  # Ctrl+C 停止
  ```

### 使用啟動腳本

- [ ] PowerShell 腳本可以執行
  ```powershell
  .\Start-FocusEnforcer.ps1
  # 應該自動啟動後端和前端
  ```

- [ ] 健康檢查腳本正常
  ```powershell
  .\Check-Health.ps1
  # 應該顯示服務狀態
  ```

---

## ✅ 瀏覽器訪問檢查

### 前端檢查

- [ ] 前端頁面可訪問
  - 開啟瀏覽器訪問：http://localhost:5173
  - 應該看到 Focus Enforcer 儀表板

- [ ] 前端 WebSocket 連線正常
  - 檢查瀏覽器 F12 Console，無錯誤訊息
  - 檢查 Network 標籤，WebSocket 連線成功

### 後端檢查

- [ ] 後端 API 可訪問
  - 開啟瀏覽器訪問：http://localhost:8000/docs
  - 應該看到 FastAPI Swagger 文檔

- [ ] 測試 API 端點
  ```powershell
  Invoke-WebRequest -Uri "http://localhost:8000/api/hardware/status"
  # 應該返回 200 OK
  ```

---

## ✅ 功能測試檢查

### 基本功能

- [ ] 儀表板顯示正常
- [ ] 模擬模式可以啟動（如果 `MOCK_HARDWARE=True`）
- [ ] Dev Panel 可以控制模擬數據
- [ ] 計時器可以啟動和暫停

### WebSocket 即時通訊

- [ ] 感測器數據即時更新
- [ ] 狀態變化即時反映在前端
- [ ] 無頻繁斷線重連

---

## ✅ 開發工具檢查

### VS Code 擴充功能（推薦）

- [ ] Python Extension (ms-python.python)
- [ ] Pylance (ms-python.vscode-pylance)
- [ ] ESLint (dbaeumer.vscode-eslint)
- [ ] Prettier (esbenp.prettier-vscode)
- [ ] Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)

### Git 配置

- [ ] `.gitignore` 檔案存在且正確
  - [ ] 包含 `venv/`
  - [ ] 包含 `node_modules/`
  - [ ] 包含 `.env`
  - [ ] 包含 `credentials.json`
  - [ ] 包含 `browser_contexts/`

---

## ✅ 硬體開發檢查（可選）

僅當需要開發或修改 ESP8266 韌體時：

- [ ] PlatformIO 已安裝
- [ ] ESP8266 開發板驅動已安裝
- [ ] `platformio.ini` 配置正確
- [ ] 可以編譯韌體
  ```powershell
  pio run
  ```
- [ ] 可以上傳韌體到硬體
  ```powershell
  pio run --target upload
  ```

---

## 🎯 完成檢查清單後

如果所有項目都已勾選：

✅ **環境配置完成！** 可以開始開發或使用系統。

如果有未完成的項目：

1. 執行 `Setup.ps1` 進行自動設置
2. 參考 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 解決問題
3. 查看 [SETUP.md](SETUP.md) 詳細設置指南

---

## 📝 快速命令參考

```powershell
# 環境設置
.\Setup.ps1

# 啟動系統
.\Start-FocusEnforcer.ps1

# 停止系統
.\Stop-FocusEnforcer.ps1

# 健康檢查
.\Check-Health.ps1

# 手動啟動後端
cd backend
.\venv\Scripts\Activate.ps1
python run.py

# 手動啟動前端
cd frontend
npm run dev
```

---

**最後更新**: 2025-12-21  
**版本**: v1.0
