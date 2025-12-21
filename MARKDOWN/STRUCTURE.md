# 📂 專案結構說明 (Project Structure)

本文件詳細描述 **Focus Enforcer** 專案的完整目錄結構與檔案功能。本專案採用 **前後端分離 (Frontend-Backend Separation)** 架構，並整合 **ESP8266 硬體韌體**。

---

## 🏗️ 頂層目錄 (Root Directory)

專案根目錄包含啟動腳本、設定檔與各子系統資料夾。

| 檔案/資料夾 | 說明 |
| :--- | :--- |
| `Start-FocusEnforcer.ps1` | **[推薦]** PowerShell 主啟動腳本。具備完整環境檢查、自動依賴安裝、端口檢查與錯誤處理功能。 |
| `Setup.ps1` | **環境設置腳本**。自動建立虛擬環境、安裝依賴、配置初始設定檔。首次使用必須執行。 |
| `Stop-FocusEnforcer.ps1` | **停止腳本**。優雅地關閉所有後端與前端服務，清理佔用的端口。 |
| `start.bat` | 批次檔啟動腳本。輕量級快速啟動方式，適合環境已配置完成的情況。 |
| `Setup.bat` | 批次檔環境設置腳本。功能同 Setup.ps1，但使用傳統批次檔格式。 |
| `README.md` | **快速啟動指南**。包含啟動方式、配置說明與常見問題排解。 |
| `platformio.ini` | **PlatformIO 設定檔**。定義硬體開發板 (D1 Mini)、框架 (Arduino) 以及所需的 C++ 函式庫 (ArduinoJson, Adafruit 等)。 |
| `package.json` | 專案根目錄的 npm 設定 (通常用於管理全域腳本，主要依賴在 `frontend/` 中)。 |
| `compile_commands.json` | C++ 編譯器生成的指令檔 (供 IDE 智慧提示使用)。 |
| `backend/` | 後端伺服器原始碼目錄。 |
| `frontend/` | 前端網頁應用程式原始碼目錄。 |
| `hardware/` | 硬體相關文件或設計圖 (目前為空，韌體源碼在 `src/`)。 |
| `MARKDOWN/` | 專案文件存放區 (包含本文件)。 |
| `src/` | **硬體韌體原始碼** (對應 `platformio.ini` 設定)。 |

---

## 🐍 後端結構 (backend/)

後端基於 **Python FastAPI**，負責業務邏輯、硬體通訊 (WebSocket) 與社交平台自動化。

### 📄 根目錄檔案
| 檔案 | 說明 |
| :--- | :--- |
| `run.py` | **後端啟動入口**。使用 Uvicorn 啟動 FastAPI 應用程式。 |
| `requirements.txt` | Python 套件依賴清單 (FastAPI, python-socketio, playwright 等)。 |
| `credentials.json` | **(自動生成)** 儲存使用者輸入的社交平台帳號密碼與 Token。 |
| `credentials.example.json` | 憑證範本檔。 |
| `test_threads_simple.py` | 獨立測試腳本，用於測試 Threads 自動化登入與發文功能。 |

### 📂 核心應用 (backend/app/)
| 資料夾/檔案 | 說明 |
| :--- | :--- |
| `main.py` | **FastAPI 應用程式主檔**。設定 CORS、掛載路由、初始化 Socket.IO 伺服器。 |
| `config.py` | **全域設定檔**。讀取環境變數 (.env) 與 `credentials.json`，管理系統參數 (如懲罰閾值)。 |
| `credential_store.py` | **憑證管理模組**。負責安全地讀取與寫入 `credentials.json`。 |
| `models.py` | **資料模型定義**。使用 Pydantic 定義資料結構 (如 `SensorData`, `PenaltyConfig`, `SystemState`)。 |
| `socket_manager.py` | **核心邏輯中樞**。管理 WebSocket 連線、處理硬體數據、判斷違規 (手機偵測、噪音、開盒) 並觸發懲罰。 |

### 📂 自動化模組 (backend/app/automation/)
| 檔案 | 說明 |
| :--- | :--- |
| `social_manager.py` | **社交平台管理器**。封裝 Playwright (瀏覽器自動化) 與 API 呼叫，執行 Threads 發文、Gmail 寄信、Discord 通知。 |

### 📂 API 路由 (backend/app/routers/)
| 檔案 | 說明 |
| :--- | :--- |
| `hardware.py` | 提供硬體狀態查詢、模擬模式 (Mock Mode) 開關控制的 API。 |
| `hostage.py` | 處理「人質」(使用者上傳的照片) 的上傳、儲存與刪除 API。 |
| `sessions.py` | 管理專注任務的階段 (開始、暫停、結束) 與狀態。 |
| `social.py` | 處理社交平台帳號設定與測試發文的 API。 |

### 📂 其他目錄
| 資料夾 | 說明 |
| :--- | :--- |
| `browser_contexts/` | 儲存 Playwright 的瀏覽器 Session (如 Cookies)，實現免登入重複使用。 |
| `hostage_evidence/` | 儲存使用者上傳的「人質」照片檔案與 metadata。 |

---

## ⚛️ 前端結構 (frontend/)

前端基於 **React + TypeScript + Vite**，提供現代化的儀表板介面。

### 📄 設定檔
| 檔案 | 說明 |
| :--- | :--- |
| `vite.config.ts` | Vite 打包設定，包含路徑別名 (@) 設定。 |
| `tailwind.config.js` | Tailwind CSS 樣式框架設定。 |
| `tsconfig.json` | TypeScript 編譯設定。 |

### 📂 原始碼 (frontend/src/)
| 資料夾/檔案 | 說明 |
| :--- | :--- |
| `main.tsx` | React 應用程式入口點。 |
| `App.tsx` | 主應用程式組件，處理路由與全域佈局。 |
| `index.css` | 全域樣式定義 (包含 Tailwind 指令)。 |

#### 🪝 Hooks (frontend/src/hooks/)
| 檔案 | 說明 |
| :--- | :--- |
| `useSocket.ts` | **WebSocket 封裝**。處理與後端的即時連線，同步硬體狀態 (`SensorData`) 與任務狀態。 |
| `useAudio.ts` | 處理音效播放 (如警報聲、成功提示音)。 |

#### 🧩 元件 (frontend/src/components/)
**1. Dashboard (儀表板核心)**
| 檔案 | 說明 |
| :--- | :--- |
| `DashboardPage.tsx` | 儀表板主頁面，整合所有子面板。 |
| `StatusPanel.tsx` | 顯示系統核心狀態 (連線、盒蓋狀態、違規次數)。 |
| `SensorChart.tsx` | 使用 Recharts 繪製即時噪音/感測數據圖表。 |
| `Timer.tsx` | 專注計時器顯示。 |
| `HostageManager.tsx` | 人質照片管理介面 (顯示當前人質)。 |
| `HostageUpload.tsx` | 人質照片上傳組件。 |
| `PenaltyConfigPanel.tsx` | 懲罰規則設定 (開啟/關閉各項偵測、設定閾值)。 |
| `PenaltyProgress.tsx` | 顯示懲罰執行的進度條。 |
| `SocialSettings.tsx` | 社交平台帳號設定表單。 |
| `DevPanel.tsx` | **開發者面板**。提供模擬硬體數據的控制項 (無需實體硬體即可測試)。 |

**2. Landing (首頁)**
| 檔案 | 說明 |
| :--- | :--- |
| `CustomCursor.tsx` | 自定義滑鼠游標效果。 |
| `MagneticButton.tsx` | 磁吸效果按鈕。 |

**3. UI (通用元件)**
位於 `frontend/src/components/ui/`，包含基於 Shadcn UI 的基礎元件 (Button, Card, Input, Slider, Switch 等)。

---

## 🔌 硬體韌體 (src/)

此目錄包含燒錄至 **D1 Mini (ESP8266)** 的 C++ 程式碼。

| 檔案 | 說明 |
| :--- | :--- |
| `main.cpp` | **韌體核心邏輯**。<br>1. 初始化 WiFi 與 WebSocket Client。<br>2. 讀取感測器數據 (LD2410 雷達, MAX9814 麥克風, 光敏電阻/霍爾感測器)。<br>3. 執行訊號處理 (如光感測器防抖動)。<br>4. 將數據打包成 JSON 傳送至後端。 |

---

## 📚 文件 (MARKDOWN/)

| 檔案 | 說明 |
| :--- | :--- |
| `OVERVIEW.md` | 專案總覽與設計理念。 |
| `SETUP.md` | 環境建置與安裝教學。 |
| `USAGE.md` | 使用者操作指南。 |
| `STRUCTURE.md` | **(本文件)** 專案結構詳細說明。 |
