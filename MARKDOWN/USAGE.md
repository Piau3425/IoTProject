# 🎮 使用指南 (User Guide)

本文件說明如何操作 **Focus Enforcer** 儀表板與執行專注階段。

---

## 🖥️ 儀表板介面概覽

儀表板分為三個主要區塊：

1. **左側控制區 (Timer & Controls)**:
    - **Timer**: 顯示剩餘時間、開始/暫停/停止按鈕。
    - **Hostage Manager**: 嵌入於計時器下方，用於上傳與管理人質照片。
    - **Penalty Configuration**: 設定哪些違規行為會觸發懲罰。
    - **Social Settings**: 設定社交平台帳號。
2. **右側狀態區 (Status & Monitor)**:
    - **Status Panel**: 顯示硬體連線狀態、各感測器即時狀態 (Phone, Presence, Box, Noise)。
    - **Violation Stats**: 顯示今日累積違規次數 (Today's Violations)。
    - **Sensor Chart**: 即時繪製感測器數值波形圖。
    - **Dev Panel** (僅模擬模式): 手動控制感測器狀態。
3. **全局覆蓋層**:
    - **Penalty Progress**: 違規時彈出，顯示懲罰執行進度 (Auth -> Upload -> Post)。
    - **State Transition**: 硬體狀態切換時的全螢幕視覺提示。
4. **頂部導覽列**:
    - **Mock Mode 開關**: 切換模擬模式/實體模式。
    - **連線狀態指示燈**: 顯示 WebSocket 連線狀況。

---

## ⏱️ 執行專注階段 (Focus Session)

### 1. 準備工作
1. 確保硬體已連線 (Hardware Connected 亮綠燈) 或開啟 Mock Mode。
2. 在 **Hostage Manager** 上傳至少一張照片。
3. 在 **Penalty Configuration** 勾選欲啟用的懲罰條件 (如 Phone Penalty, Presence Penalty)。

### 2. 開始專注
1. 設定專注時間 (預設 25 分鐘)。
2. 點擊 **Start Focus** 按鈕。
3. **進入準備期 (PREPARING)**:
    - 系統給予 10 秒倒數。
    - 請在此時將手機放入盒子、關上盒蓋、並坐定位置。
    - LCD 顯示 "PREPARING..."。

### 3. 專注進行中 (FOCUSING)
- 倒數結束後，進入 **FOCUSING** 狀態。
- 系統開始嚴格監控：
    - **手機**: 必須保持在 NFC/盒蓋偵測範圍內。
    - **人體**: 雷達必須偵測到有人在座。
    - **盒蓋**: 必須保持關閉。
    - **噪音**: (若啟用) 必須低於設定分貝數。

### 4. 違規與懲罰 (VIOLATION)
- 若偵測到違規 (如打開盒子)：
    - 狀態變為 **VIOLATION**。
    - 儀表板顯示紅色警示。
    - 觸發 **Social Shame Protocol**：
        - 隨機挑選一張人質照片。
        - 自動發布至 Threads。
        - (可選) 發送 Email 通知。
- 懲罰執行後，狀態可能需手動重置或自動恢復 (視設定而定)。

### 5. 暫停與結束
- **暫停**: 點擊 **Pause** 可暫時停止監測 (狀態變為 PAUSED)。
- **結束**: 計時結束或點擊 **Stop**，狀態回到 IDLE。

---

## 🧪 模擬模式 (Mock Mode)

若無實體硬體，可使用模擬模式測試功能：

1. 點擊頂部的 **Enable Mock Mode**。
2. **Dev Panel** 會出現在右下角 (或狀態區)。
3. 您可以手動切換感測器狀態：
    - **Toggle Phone**: 模擬手機放入/取出。
    - **Toggle Presence**: 模擬人離開/回來。
    - **Toggle Box**: 模擬盒蓋開啟/關閉。
4. 觀察儀表板與狀態機的反應。

---

## 📸 人質管理 (Hostage Manager)

位於左側 **Timer** 卡片下方：

- **上傳**: 點擊或拖曳圖片至上傳區 (支援 JPG/PNG)。
- **預覽**: 查看已上傳的圖片。
- **刪除**: 移除不想使用的圖片。
- **機制**: 違規時，後端會從此列表中隨機挑選一張圖片進行發布。
