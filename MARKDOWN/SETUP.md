# 🛠️ 系統安裝與設定指南

本指南將引導您完成 **THE FOCUS ENFORCER v1.0** 的軟硬體建置。

---

## 📋 需求清單

### 軟體環境
- **OS**: Windows 10/11 (推薦)
- **Python**: 3.10 或以上
- **Node.js**: 18.0 或以上
- **Git**: 版本控制工具
- **VS Code**: 推薦編輯器 (需安裝 PlatformIO 擴充功能)

### 硬體清單 (v1.0)
| 元件 | 數量 | 用途 |
|------|------|------|
| **Wemos D1 Mini (ESP8266)** | 1 | 主控板 |
| **1602 LCD (含 I2C 轉板)** | 1 | 狀態顯示 |
| **KY-033 紅外線感測器** | 1 | 盒蓋開關偵測 (反射式) |
| **LD2410 mmWave 雷達** | 1 | 人體存在偵測 |
| **MAX9814 聲音感測器** | 1 | 環境噪音偵測 |
| **PN532 NFC 模組** | 1 | 手機放入偵測 (I2C 模式) |
| **麵包板與杜邦線** | 若干 | 連接電路 |

---

## 🔌 硬體接線指南

請依照下表將各模組連接至 Wemos D1 Mini。

### GPIO 分配表

| 模組 | 接腳 | D1 Mini | GPIO | 備註 |
| :--- | :--- | :--- | :--- | :--- |
| **1602 LCD** | SDA | D2 | GPIO4 | I2C Bus |
| | SCL | D1 | GPIO5 | I2C Bus |
| | VCC | 5V | - | |
| | GND | GND | - | |
| **PN532 NFC** | SDA | D2 | GPIO4 | I2C Bus (共用) |
| | SCL | D1 | GPIO5 | I2C Bus (共用) |
| | VCC | 3V3/5V | - | |
| | GND | GND | - | |
| **KY-033 IR** | DO | D7 | GPIO13 | 數位輸出 (中斷) |
| | VCC | 3V3 | - | |
| | GND | GND | - | |
| **LD2410 Radar** | TX | D5 | GPIO14 | 接軟體串列 RX |
| | RX | D6 | GPIO12 | 接軟體串列 TX |
| | VCC | 5V | - | |
| | GND | GND | - | |
| **MAX9814 Mic** | AO | A0 | ADC0 | 類比輸出 |
| | VCC | 3V3 | - | |
| | GND | GND | - | |

---

## 💻 軟體安裝步驟

### 1. 專案初始化
在專案根目錄開啟 PowerShell，執行以下指令以自動設定環境：

```powershell
.\Setup.ps1
```
此腳本會：
- 建立 Python 虛擬環境 (`.venv`)
- 安裝 Python 依賴 (`backend/requirements.txt`)
- 安裝 Node.js 依賴 (`frontend/package.json`)
- 建立初始設定檔

### 2. 燒錄韌體
1. 開啟 VS Code。
2. 安裝 **PlatformIO IDE** 擴充功能。
3. 開啟 `src/main.cpp`。
4. 修改 WiFi 設定：
   ```cpp
   const char* WIFI_SSID = "Your_SSID";
   const char* WIFI_PASS = "Your_Password";
   const char* WS_HOST = "Your_PC_IP"; // 電腦的區域網路 IP
   ```
5. 連接 D1 Mini 至電腦 USB。
6. 點擊 PlatformIO 下方的 **Upload** (➡️) 按鈕進行編譯與燒錄。

### 3. 啟動系統
執行主啟動腳本：

```powershell
.\Start-FocusEnforcer.ps1
```
系統將會：
1. 啟動後端伺服器 (http://localhost:8000)
2. 啟動前端開發伺服器 (http://localhost:5173)
3. 自動開啟瀏覽器進入儀表板

---

## ⚙️ 社交平台設定

若要啟用社交羞辱功能，需設定憑證：

1. 啟動系統後，進入儀表板的 **Social Settings** 區塊。
2. 輸入 Threads 帳號密碼 (用於自動發文)。
3. 輸入 Gmail 帳號與應用程式密碼 (用於發信)。
4. 點擊 **Save Credentials**。
5. 系統會將憑證加密儲存於 `backend/credentials.json`。

> **注意**: 建議使用分身帳號進行測試，以免發生意外。

