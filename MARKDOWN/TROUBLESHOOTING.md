# ❓ 疑難排解 (Troubleshooting)

## 🔌 硬體連線問題

### Q: 儀表板顯示 "Hardware Disconnected"
1. **檢查電源**: 確認 D1 Mini 已透過 USB 連接至電腦或電源。
2. **檢查 WiFi**: 確認 `src/main.cpp` 中的 `WIFI_SSID` 與 `WIFI_PASS` 設定正確，且 D1 Mini 與電腦在同一區域網路下。
3. **檢查 IP**: 確認 `src/main.cpp` 中的 `WS_HOST` 已設定為電腦的正確 IP 位址 (可用 `ipconfig` 查詢)。
4. **防火牆**: 確保電腦防火牆未阻擋 8000 埠 (Python 後端)。

### Q: 感測器數值異常
- **KY-033 (盒蓋)**: 調整模組上的藍色電位器，直到在盒蓋關閉時指示燈熄滅/亮起 (視邏輯而定)，確保觸發距離正確。
- **NFC**: 確保手機有 NFC 功能且已開啟，並緊貼 PN532 線圈。
- **雷達**: LD2410 需預熱約 1-2 秒，且避免前方有金屬遮蔽物。

---

## 🐍 後端問題

### Q: 啟動時出現 "Module not found"
請重新執行安裝腳本：
```powershell
.\Setup.ps1
```
確保所有依賴套件已正確安裝於虛擬環境中。

### Q: Playwright 錯誤 / 瀏覽器無法啟動
首次執行可能需要安裝瀏覽器二進位檔：
```powershell
playwright install chromium
```
(Setup.ps1 通常會自動處理此步驟)

---

## ⚛️ 前端問題

### Q: 頁面一片空白或載入失敗
1. 檢查終端機是否有錯誤訊息。
2. 確認 Node.js 版本是否為 18+。
3. 嘗試刪除 `frontend/node_modules` 並重新執行 `npm install`。

### Q: 無法上傳人質照片
- 檢查 `backend/hostage_evidence` 資料夾是否存在且有寫入權限。
- 確認圖片格式為 JPG 或 PNG。
- 單次上傳數量限制為 30 張。
