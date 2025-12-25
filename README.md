# 🛡️ THE FOCUS ENFORCER (專注執法者)

歡迎使用 **The Focus Enforcer** —— 一個結合硬體監控與社交懲罰機制的「零信任」專注力強化系統。

本專案透過實體硬體盒子、多重感測器以及嚴格的軟體狀態機，強制使用者在專注期間遠離手機並保持在座位上。一旦違規，系統將自動啟動「社交羞辱協定」，將您最不願公開的照片發佈至社交平台。

---

## 📚 專案文件導覽 (Documentation)

詳細的專案說明文件位於 `MARKDOWN` 資料夾中，請參考以下連結：

- **📖 [專案總覽 (Overview)](MARKDOWN/OVERVIEW.md)**
  了解專案的核心理念、功能特色與運作邏輯。

- **🛠️ [安裝與設定指南 (Setup Guide)](MARKDOWN/SETUP.md)**
  硬體清單、接線圖以及軟體環境的安裝步驟。

- **🎮 [使用指南 (User Guide)](MARKDOWN/USAGE.md)**
  如何操作儀表板、上傳人質照片以及開始專注 Session。

- **👨‍💻 [開發者手冊 (Developer Manual)](MARKDOWN/DEVELOPER_MANUAL.md)**
  前端與後端的程式架構說明，適合想要修改或貢獻程式碼的開發者。

- **🏗️ [專案結構 (File Structure)](MARKDOWN/STRUCTURE.md)**
  專案資料夾與主要檔案的用途說明。

- **🔌 [Socket 通訊協定 (Socket Communication)](MARKDOWN/SOCKET_COMMUNICATION.md)**
  前端、後端與硬體裝置之間的 WebSocket 通訊協議定義。

- **❓ [疑難排解 (Troubleshooting)](MARKDOWN/TROUBLESHOOTING.md)**
  常見問題與解決方案。

---

## 🚀 快速開始 (Quick Start)

### 1. 初始化環境
首次使用請執行以下指令以安裝所需依賴：
```powershell
.\Setup.ps1
```

### 2. 啟動系統
執行主啟動腳本，系統將自動開啟後端、前端並打開瀏覽器：
```powershell
.\Start-FocusEnforcer.ps1
```

---

## ✨ 核心功能
- **零信任監控**: 結合紅外線、毫米波雷達、NFC 與聲音感測器。
- **社交羞辱**: 違規自動發佈 Thread 或寄送 Email。
- **實體硬體**: D1 Mini + 1602 LCD 顯示器。
- **現代化儀表板**: React + Tailwind CSS 打造的即時監控介面。
