# ✅ 開發與維護檢查清單 (Checklist)

## 每日啟動檢查
- [ ] 執行 `Start-FocusEnforcer.ps1` 確保服務正常啟動。
- [ ] 確認儀表板顯示 "Hardware Connected" (或開啟 Mock Mode)。
- [ ] 測試 Socket 連線 (觀察 Timer 是否同步)。

## 硬體維護
- [ ] **KY-033 校準**: 每週檢查一次紅外線感測器的觸發距離，確保盒蓋開關偵測靈敏。
- [ ] **接線檢查**: 確認杜邦線無鬆脫，特別是 I2C (SDA/SCL) 線路。
- [ ] **電源**: 確認 D1 Mini 供電穩定 (建議使用獨立 USB 供電或優質 Hub)。

## 軟體發布前檢查
- [ ] **Git Security**: 執行 `Check-GitSecurity.ps1` 確保無憑證洩漏。
- [ ] **Credentials**: 確認 `credentials.json` 包含有效的測試帳號。
- [ ] **Clean Build**: 刪除 `backend/__pycache__` 與 `frontend/dist` 確保乾淨建置。

## 功能測試 (Release Testing)
- [ ] **流程測試**: 完整執行一次 25 分鐘專注流程 (IDLE -> PREPARING -> FOCUSING -> COMPLETED)。
- [ ] **違規測試**: 
    - [ ] 測試打開盒蓋是否觸發 VIOLATION。
    - [ ] 測試移開手機是否觸發 VIOLATION。
    - [ ] 測試離開座位是否觸發 VIOLATION。
- [ ] **懲罰測試**: 確認 Threads 發文功能是否正常運作 (建議使用測試帳號)。
- [ ] **人質系統**: 確認圖片上傳、刪除與隨機選取功能正常。
