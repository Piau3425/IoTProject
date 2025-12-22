# 📂 專案結構說明 (Project Structure)

本文件詳細描述 **Focus Enforcer** 專案的完整目錄結構與檔案功能。本專案採用 **前後端分離** 架構，並整合 **ESP8266 硬體韌體**。

---

## 🏗️ 頂層目錄 (Root Directory)

| 檔案/資料夾 | 說明 |
| :--- | :--- |
| `Start-FocusEnforcer.ps1` | **主啟動腳本**。一鍵啟動後端、前端與環境檢查。 |
| `Setup.ps1` | **環境設置腳本**。建立 Python 虛擬環境、安裝依賴。 |
| `Stop-FocusEnforcer.ps1` | **停止腳本**。關閉所有相關服務與端口。 |
| `Check-Health.ps1` | 系統健康檢查腳本。 |
| `Check-GitSecurity.ps1` | Git 安全檢查腳本，防止憑證洩漏。 |
| `Git-SafePush.ps1` | 安全推送腳本，執行推送前檢查。 |
| `platformio.ini` | **PlatformIO 設定檔**。定義硬體開發板 (D1 Mini) 與依賴庫。 |
| `backend/` | 後端伺服器原始碼。 |
| `frontend/` | 前端網頁應用程式原始碼。 |
| `src/` | **硬體韌體原始碼** (C++)。 |
| `MARKDOWN/` | 專案文件。 |

---

## 🐍 後端結構 (backend/)

基於 **Python FastAPI**，負責業務邏輯、硬體通訊與自動化。

### 核心檔案
| 檔案 | 說明 |
| :--- | :--- |
| `run.py` | 後端啟動入口 (Uvicorn)。 |
| `requirements.txt` | Python 依賴清單。 |
| `credentials.json` | **(敏感)** 儲存社交平台帳號密碼與 Token。 |

### 應用程式 (backend/app/)
| 資料夾/檔案 | 說明 |
| :--- | :--- |
| `main.py` | **FastAPI 主程式**。路由掛載、生命週期管理。 |
| `socket_manager.py` | **Socket.IO 管理器**。處理 WebSocket 連線、硬體數據同步、模擬模式邏輯。 |
| `models.py` | **資料模型**。定義 `SensorData`, `HardwareState`, `FocusSession` 等 Pydantic 模型。 |
| `config.py` | 設定檔管理。 |
| `credential_store.py` | 憑證存取管理。 |

### 路由 (backend/app/routers/)
| 檔案 | 說明 |
| :--- | :--- |
| `sessions.py` | 專注階段管理 (開始、暫停、結束)。 |
| `hardware.py` | 硬體狀態查詢與控制 API。 |
| `hostage.py` | 人質照片上傳與管理 API。 |
| `social.py` | 社交平台設定與測試 API。 |

### 自動化 (backend/app/automation/)
| 檔案 | 說明 |
| :--- | :--- |
| `social_manager.py` | 社交平台自動化邏輯 (Threads 發文、Gmail 發信)。 |

---

## ⚛️ 前端結構 (frontend/)

基於 **React + Vite + TypeScript**。

### 核心設定
| 檔案 | 說明 |
| :--- | :--- |
| `vite.config.ts` | Vite 設定檔 (包含 Proxy 設定)。 |
| `tailwind.config.js` | Tailwind CSS 設定。 |
| `package.json` | 前端依賴清單。 |

### 原始碼 (frontend/src/)
| 資料夾/檔案 | 說明 |
| :--- | :--- |
| `main.tsx` | React 入口點。 |
| `App.tsx` | 主應用元件。 |
| `hooks/useSocket.ts` | **Socket Hook**。封裝 WebSocket 連線與狀態同步邏輯。 |
| `hooks/useAudio.ts` | 音效播放 Hook。 |

### 元件 (frontend/src/components/Dashboard/)
| 檔案 | 說明 |
| :--- | :--- |
| `DashboardPage.tsx` | 儀表板主頁面。 |
| `HostageManager.tsx` | **人質管理器**。圖片上傳與預覽介面。 |
| `PenaltyConfigPanel.tsx` | **懲罰設定面板**。開關各項感測器懲罰條件。 |
| `StatusPanel.tsx` | 顯示硬體連線狀態與感測器數值。 |
| `Timer.tsx` | 專注計時器與控制按鈕。整合 `HostageManager` 進行人質管理。 |
| `SensorChart.tsx` | 感測器數據圖表。 |
| `SocialSettings.tsx` | 社交平台帳號設定介面。 |
| `PenaltyProgress.tsx` | **懲罰執行進度**。顯示違規時的懲罰執行步驟與狀態。 |
| `StateTransitionOverlay.tsx` | **狀態轉場疊加層**。提供硬體狀態切換時的視覺回饋。 |
| `DevPanel.tsx` | **開發者面板**。模擬模式下的硬體控制介面。 |

---

## 🔌 硬體韌體 (src/)

| 檔案 | 說明 |
| :--- | :--- |
| `main.cpp` | **韌體主程式** (ESP8266/D1 Mini)。包含狀態機邏輯、感測器讀取 (KY-033, LD2410, PN532)、LCD 顯示與 WebSocket Client 實作。 |
