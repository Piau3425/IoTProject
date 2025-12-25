# 📂 專案結構說明 (Project Structure) v1.0

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
| `session_store.py` | **會話儲存**。負責將專注階段歷史記錄儲存為 JSON 檔案。 |
| `daily_violation_store.py` | **每日違規儲存**。記錄與持久化每日累積違規次數，並於隔日自動重置。 |
| `progressive_penalty.py` | **懲罰系統**。管理違規處置邏輯 (立即執行) 與執行回呼。 |
| `state_manager.py` | **狀態管理器**。集中管理硬體與系統狀態的單例模式。 |
| `violation_checker.py` | **違規檢查器**。負責偵測感測器數據是否違反專注規則。 |
| `mock_hardware.py` | **模擬硬體**。軟體模擬感測器數據，用於開發與測試。 |
| `middleware.py` | FastAPI 中間件 (CORS 等)。 |
| `exceptions.py` | 自定義錯誤類別。 |
| `logger.py` | 日誌記錄工具 (Safe Print)。 |

### 自動化 (backend/app/automation/)
| 檔案 | 說明 |
| :--- | :--- |
### 自動化 (backend/app/automation/)
| 檔案 | 說明 |
| :--- | :--- |
| `social_manager.py` | 社交平台自動化邏輯 (Threads 發文、Gmail 發信)。 |


### 路由 (backend/app/routers/)
| 檔案 | 說明 |
| :--- | :--- |
| `sessions.py` | 專注階段管理 (開始、暫停、結束) 與歷史紀錄 (`/history`, `/statistics`)。 |
| `hardware.py` | 硬體狀態查詢與控制 API。 |
| `hostage.py` | 人質照片上傳與管理 API。 |
| `social.py` | 社交平台設定與測試 API。 |

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
| `hooks/usePhysics.ts` | **物理模擬 Hook**。用於處理 UI 的物理動效。 |

### 多語言系統 (frontend/src/language/)
| 檔案 | 說明 |
| :--- | :--- |
| `en.json` | **英文語言文件**。包含所有前端顯示文本的英文翻譯。 |
| `zh-tw.json` | **繁體中文語言文件**。包含所有前端顯示文本。 |
| `index.ts` | 語言文件索引，匯出所有語言定義和類型。 |

### Context (frontend/src/context/)
| 檔案 | 說明 |
| :--- | :--- |
| `LanguageContext.tsx` | **多語言 Context**。提供 `useLanguage` Hook、`t()` 翻譯函數和語言切換功能。 |

### 元件 (frontend/src/components/Dashboard/)
| 檔案 | 說明 |
| :--- | :--- |
| `DashboardPage.tsx` | 儀表板主頁面。 |
| `Header.tsx` | 應用程式頂部導航與狀態列。 |
| `HostageManager.tsx` | **人質管理器**。人質照片管理的核心視圖。 |
| `HostageUpload.tsx` | **人質上傳**。處理照片上傳交互的元件。 |
| `PenaltyConfigPanel.tsx` | **懲罰設定面板**。開關各項感測器懲罰條件。 |
| `PenaltyIndicator.tsx` | **懲罰指示器**。視覺化顯示當前的懲罰等級 (藍/黃/紅)。 |
| `StatusPanel.tsx` | 顯示硬體連線狀態與感測器數值。 |
| `Timer.tsx` | 專注計時器與控制按鈕。 |
| `SensorChart.tsx` | 感測器數據圖表。 |
| `SocialSettings.tsx` | 社交平台帳號設定介面。 |
| `PenaltyProgress.tsx` | **懲罰執行進度**。顯示違規時的懲罰執行步驟與狀態。 |
| `StateTransitionOverlay.tsx` | **狀態轉場疊加層**。提供硬體狀態切換時的視覺回饋。 |
| `ProgressivePenaltyConfig.tsx` | **階段性懲罰設定**。設定不同違規次數對應的懲罰平台 (Discord/Gmail)。 |
| `ViolationStats.tsx` | **違規統計**。顯示今日累積違規次數卡片。 |
| `DevPanel.tsx` | **開發者面板**。模擬模式下的硬體控制介面。 |

### Landing 元件 (frontend/src/components/Landing/)
| 檔案 | 說明 |
| :--- | :--- |
| `MagneticButton.tsx` | **磁力按鈕**。具有磁吸效果的 UI 互動按鈕。 |

### 其他 UI 元件 (frontend/src/components/ui/)
| 檔案 | 說明 |
| :--- | :--- |
| `MorphingDigit.tsx` | **變形數字**。用於顯示流暢變化的數字動畫 (SDF/Framber Motion)。 |
| `*.tsx` | 其他基於 shadcn/ui 的通用元件。 |

---

## 🔌 硬體韌體 (src/)

| 檔案 | 說明 |
| :--- | :--- |
| `main.cpp` | **韌體主程式** (ESP8266/D1 Mini)。包含狀態機邏輯、感測器讀取 (KY-033, LD2410, PN532)、LCD 顯示與 WebSocket Client 實作。 |
