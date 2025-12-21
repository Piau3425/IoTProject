# 🔧 疑難排解指南 (Troubleshooting Guide)

本文件列出 Focus Enforcer 系統常見問題及解決方案。

---

## 📋 目錄

1. [環境設置問題](#環境設置問題)
2. [啟動問題](#啟動問題)
3. [連線問題](#連線問題)
4. [硬體相關問題](#硬體相關問題)
5. [社交平台整合問題](#社交平台整合問題)
6. [效能問題](#效能問題)

---

## 環境設置問題

### ❌ Python 未安裝或版本過舊

**症狀：**
```
[ERROR] Python not found! Please install Python 3.8 or higher.
```

**解決方式：**
1. 下載並安裝 Python 3.8 或更高版本：https://www.python.org/downloads/
2. 安裝時勾選 "Add Python to PATH"
3. 驗證安裝：
   ```powershell
   python --version
   ```

---

### ❌ Node.js 未安裝或版本過舊

**症狀：**
```
[ERROR] Node.js not found! Please install Node.js 18 or higher.
```

**解決方式：**
1. 下載並安裝 Node.js 18 LTS 或更高版本：https://nodejs.org/
2. 驗證安裝：
   ```powershell
   node --version
   npm --version
   ```

---

### ❌ 虛擬環境建立失敗

**症狀：**
```
[ERROR] Failed to create virtual environment
```

**可能原因：**
- Python 安裝不完整
- 磁碟空間不足
- 權限問題

**解決方式：**
```powershell
# 手動建立虛擬環境
cd backend
python -m venv venv

# 啟動虛擬環境
.\venv\Scripts\Activate.ps1

# 升級 pip
python -m pip install --upgrade pip

# 安裝依賴
pip install -r requirements.txt
```

---

### ❌ Playwright 瀏覽器安裝失敗

**症狀：**
```
playwright._impl._api_types.Error: Executable doesn't exist
```

**解決方式：**
```powershell
cd backend
.\venv\Scripts\Activate.ps1

# 安裝 Playwright 瀏覽器
playwright install chromium

# 如果網路有問題，可以設定代理
$env:PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright"
playwright install chromium
```

---

## 啟動問題

### ❌ 端口已被佔用

**症狀：**
```
[WARNING] Port 8000 is already in use!
[WARNING] Port 5173 is already in use!
```

**解決方式 1 - 使用停止腳本：**
```powershell
.\Stop-FocusEnforcer.ps1
```

**解決方式 2 - 手動查找並終止：**
```powershell
# 查找佔用端口的進程
netstat -ano | findstr "8000"
netstat -ano | findstr "5173"

# 終止進程（替換 <PID> 為實際的進程 ID）
taskkill /PID <PID> /F
```

**解決方式 3 - 修改配置使用不同端口：**

編輯 `backend/.env`：
```env
PORT=8001  # 改為其他端口
```

編輯 `frontend/vite.config.ts`：
```typescript
server: {
  port: 5174,  // 改為其他端口
  ...
}
```

---

### ❌ 後端無法啟動

**症狀：**
```
ModuleNotFoundError: No module named 'fastapi'
```

**解決方式：**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

### ❌ 前端無法啟動

**症狀：**
```
Error: Cannot find module 'vite'
```

**解決方式：**
```powershell
cd frontend
rm -Recurse -Force node_modules
rm package-lock.json
npm install
```

---

### ❌ PowerShell 執行政策限制

**症狀：**
```
無法載入檔案，因為這個系統上已停用指令碼執行。
```

**解決方式：**
```powershell
# 暫時允許執行腳本（當前 PowerShell 視窗）
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 或永久允許（需要管理員權限）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 然後執行啟動腳本
.\Start-FocusEnforcer.ps1
```

---

## 連線問題

### ❌ 前端無法連接後端 API

**症狀：**
- 瀏覽器控制台顯示 `ERR_CONNECTION_REFUSED`
- API 請求失敗

**檢查步驟：**

1. **確認後端正在運行：**
   ```powershell
   .\Check-Health.ps1
   ```

2. **測試後端 API：**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:8000/api/hardware/status"
   ```

3. **檢查防火牆設定：**
   - Windows 防火牆可能阻擋本地連線
   - 允許 Python 和 Node 通過防火牆

4. **檢查 Vite proxy 配置：**
   
   查看 `frontend/vite.config.ts`：
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:8000',
         changeOrigin: true,
       },
     },
   }
   ```

---

### ❌ WebSocket 連線失敗

**症狀：**
- 前端顯示 "已斷線" (Disconnected)
- 即時數據無法更新

**解決方式：**

1. **確認後端 WebSocket 端點：**
   ```powershell
   # 測試 Socket.IO 端點
   Invoke-WebRequest -Uri "http://localhost:8000/socket.io/"
   ```

2. **檢查瀏覽器控制台：**
   - 打開 F12 開發者工具
   - 查看 Network 標籤的 WebSocket 連線
   - 查看 Console 的錯誤訊息

3. **重啟服務：**
   ```powershell
   .\Stop-FocusEnforcer.ps1
   .\Start-FocusEnforcer.ps1
   ```

---

## 硬體相關問題

### ❌ ESP8266 無法連線

**症狀：**
- 儀表板顯示 "Hardware: Disconnected"
- 沒有收到感測器數據

**檢查步驟：**

1. **確認硬體模式設定：**
   
   編輯 `backend/.env`：
   ```env
   # 實體硬體模式
   MOCK_HARDWARE=False
   
   # 模擬模式（測試用）
   MOCK_HARDWARE=True
   ```

2. **檢查 ESP8266 網路設定：**
   - 確認 ESP8266 已連接到 WiFi
   - 確認 ESP8266 與電腦在同一網段
   - 檢查 `src/main.cpp` 中的 WebSocket 伺服器位址

3. **查看後端日誌：**
   - 後端終端會顯示硬體連線狀態
   - 查找 `[HARDWARE WS]` 開頭的訊息

4. **使用模擬模式測試：**
   ```powershell
   # 編輯 backend/.env
   # 設定 MOCK_HARDWARE=True
   # 重啟系統
   ```

---

### ❌ 感測器數據異常

**症狀：**
- 雷達持續顯示有人/沒人
- 麥克風音量異常
- 盒蓋狀態錯誤

**解決方式：**

1. **校準感測器：**
   - 檢查硬體接線
   - 調整感測器位置
   - 修改 `src/main.cpp` 中的閾值參數

2. **檢查電源供應：**
   - ESP8266 需要穩定的 5V 電源
   - 電源不足可能導致感測器讀數不穩定

3. **查看原始數據：**
   - 在儀表板開啟 "Dev Panel"
   - 查看即時感測器數值
   - 判斷是硬體問題還是軟體判斷問題

---

## 社交平台整合問題

### ❌ Gmail 寄信失敗

**症狀：**
```
[GMAIL] Failed to send email
```

**可能原因與解決方式：**

1. **App Password 錯誤：**
   - 重新產生 App Password
   - 確保複製時沒有空格
   - 在 `credentials.json` 中正確設定

2. **未啟用兩步驟驗證：**
   - 前往 https://myaccount.google.com/security
   - 啟用兩步驟驗證
   - 產生應用程式密碼

3. **Gmail 帳號設定問題：**
   - 確認 Gmail 帳號未被停用
   - 檢查 Gmail 的安全性設定
   - 確認未超過每日寄信限制

4. **測試設定：**
   ```powershell
   # 在儀表板的 Social Settings 面板
   # 點擊 "Test Gmail" 按鈕
   # 檢查錯誤訊息
   ```

---

### ❌ Threads 發文失敗

**症狀：**
```
[THREADS] Failed to post
```

**解決方式：**

1. **檢查憑證：**
   - 確認 `THREADS_USER_ID` 正確
   - 確認 `THREADS_ACCESS_TOKEN` 未過期
   - Meta 開發者平台更新 Token

2. **API 權限問題：**
   - 確認應用程式已獲得 Threads API 權限
   - 前往 https://developers.facebook.com/
   - 檢查應用程式狀態

3. **使用 Web 自動化備案：**
   - 系統會自動嘗試使用 Playwright 登入發文
   - 首次需要手動登入並授權

---

### ❌ Discord Webhook 無法發送

**症狀：**
```
[DISCORD] Failed to send message
```

**解決方式：**

1. **檢查 Webhook URL：**
   - 確認 URL 格式正確
   - 測試 Webhook：
     ```powershell
     Invoke-RestMethod -Uri "YOUR_WEBHOOK_URL" -Method Post -Body (@{content="Test"} | ConvertTo-Json) -ContentType "application/json"
     ```

2. **Webhook 已刪除或停用：**
   - 重新建立 Discord Webhook
   - 更新 `credentials.json`

---

## 效能問題

### ❌ 系統回應緩慢

**可能原因與解決方式：**

1. **後端過載：**
   - 檢查後端 CPU 使用率
   - 查看是否有大量錯誤日誌
   - 重啟後端服務

2. **前端效能問題：**
   - 清除瀏覽器快取
   - 關閉不必要的瀏覽器擴充功能
   - 檢查是否有 JavaScript 錯誤

3. **WebSocket 連線過多：**
   - 關閉多餘的前端分頁
   - 檢查是否有其他程式連接到 WebSocket

---

### ❌ 記憶體使用過高

**解決方式：**

1. **Playwright 瀏覽器實例：**
   - 社交平台自動化會使用瀏覽器
   - 在不使用時關閉瀏覽器實例
   - 定期重啟系統

2. **Python 記憶體洩漏：**
   - 檢查是否有未關閉的連線
   - 重啟後端服務

---

## 🔍 除錯工具

### 健康檢查
```powershell
.\Check-Health.ps1
```

### 查看日誌
- **後端日誌**：後端終端視窗
- **前端日誌**：瀏覽器 F12 開發者工具 > Console
- **網路請求**：瀏覽器 F12 > Network

### API 測試
```powershell
# 後端狀態
Invoke-WebRequest -Uri "http://localhost:8000/api/hardware/status"

# API 文檔
Start-Process "http://localhost:8000/docs"
```

### 重置系統
```powershell
# 停止所有服務
.\Stop-FocusEnforcer.ps1

# 清理
cd backend
Remove-Item -Recurse -Force browser_contexts, hostage_evidence, __pycache__

# 重新安裝依賴
.\Setup.ps1

# 重新啟動
.\Start-FocusEnforcer.ps1
```

---

## 📞 取得協助

如果以上方法都無法解決問題：

1. **檢查文件**：
   - [README.md](../README.md) - 快速啟動指南
   - [SETUP.md](SETUP.md) - 詳細設置指南
   - [USAGE.md](USAGE.md) - 使用說明

2. **查看日誌**：
   - 收集後端和前端的錯誤訊息
   - 記錄重現問題的步驟

3. **環境資訊**：
   ```powershell
   # 系統資訊
   systeminfo
   
   # Python 版本
   python --version
   
   # Node.js 版本
   node --version
   
   # 已安裝套件
   cd backend
   .\venv\Scripts\Activate.ps1
   pip list
   ```

---

**最後更新**: 2025-12-21  
**版本**: v1.0
