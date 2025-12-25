# 📡 Socket.IO 通訊架構完整文件

**文件版本**: 1.0  
**最後更新**: 2025-12-23  
**狀態**: ✅ 已驗證可運行

本文件詳細記錄 Focus Enforcer v1.0 的 Socket.IO 通訊架構，包含成功運行的配置、通訊協定、故障排除指南等完整資訊。

---

## 📋 目錄

1. [系統架構概覽](#系統架構概覽)
2. [技術棧與版本](#技術棧與版本)
3. [連線配置](#連線配置)
4. [通訊協定](#通訊協定)
5. [連線流程](#連線流程)
6. [關鍵實作細節](#關鍵實作細節)
7. [故障排除指南](#故障排除指南)
8. [開發環境設置](#開發環境設置)

---

## 🏗️ 系統架構概覽

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   Frontend (React)  │         │  Backend (FastAPI)  │         │ Hardware (ESP8266)  │
│   Port: 5173        │◄────────┤  Port: 8000         │◄────────┤  WebSocket Client   │
│                     │         │                     │         │                     │
│  socket.io-client   │         │  python-socketio    │         │  Custom Protocol    │
│  ^4.7.4             │         │  v5.11.0            │         │                     │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
         │                                 │
         │   Socket.IO over WebSocket      │
         │   /socket.io/                   │
         └─────────────────────────────────┘
         
開發環境:
- Frontend: Vite dev server with proxy
- Backend: Uvicorn ASGI server
- Windows: 需要特殊處理 (ProactorEventLoop + Safe Print)
```

---

## 🔧 技術棧與版本

### 後端 (Backend)
```python
# requirements.txt (關鍵套件)
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-socketio==5.11.0         # ⚠️ 版本很重要！
websockets>=12.0
aiohttp>=3.9.0

# Python 版本: 3.13.0
# 事件循環: asyncio.WindowsProactorEventLoopPolicy (Windows)
```

### 前端 (Frontend)
```json
{
  "socket.io-client": "^4.7.4",  // ⚠️ 必須與後端相容
  "react": "^18.2.0",
  "vite": "^5.0.0"
}
```

### 關鍵相容性
- `python-socketio` v5.11.0 使用 Engine.IO v4
- `socket.io-client` v4.x 也使用 Engine.IO v4
- ⚠️ 版本不匹配會導致連線失敗

---

## ⚙️ 連線配置

### 1. 後端 Socket.IO 初始化

**檔案**: `backend/app/socket_manager.py`

```python
class SocketManager:
    def __init__(self):
        # ✅ 正確的初始化方式
        self.sio = socketio.AsyncServer(
            async_mode='asgi',              # ⚠️ 必須使用 'asgi' 模式
            cors_allowed_origins='*',       # 開發環境允許所有來源
            logger=False,                   # 關閉詳細日誌
            engineio_logger=False           # 關閉 engine.io 日誌
        )
        # 建立 ASGI 應用
        self.app = socketio.ASGIApp(self.sio)
```

**整合至 FastAPI**:

**檔案**: `backend/app/main.py`

```python
# ✅ 正確的整合方式
fastapi_app = FastAPI(...)

# 使用 socketio.ASGIApp 包裝 FastAPI
app = socketio.ASGIApp(
    socket_manager.sio,
    other_asgi_app=fastapi_app,
    socketio_path='socket.io'    # ⚠️ 不要加 '/' 前綴！
)

# ❌ 錯誤方式: app = socket_manager.app
# ❌ 錯誤方式: socketio_path='/socket.io'  (會導致路徑錯誤)
```

### 2. Uvicorn 啟動配置

**檔案**: `backend/run.py`

```python
# ✅ Windows 必要設定
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

uvicorn.run(
    "app.main:app",              # ⚠️ 指向包裝後的 app，不是 fastapi_app
    host="0.0.0.0",
    port=8000,
    loop="asyncio",
    workers=1,                    # ⚠️ 必須使用單一進程
    reload=False                  # 生產環境關閉
)
```

### 3. 前端連線配置

**檔案**: `frontend/vite.config.ts`

```typescript
// ✅ Vite 代理配置 (開發環境)
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/socket.io': {            // ⚠️ 代理 Socket.IO 路徑
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,                 // ⚠️ 啟用 WebSocket 支援
      },
    },
  },
})
```

**檔案**: `frontend/src/hooks/useSocket.ts`

```typescript
// ✅ 開發環境直連後端，避免代理問題
const isDev = window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1'
const socketUrl = isDev ? 'http://localhost:8000' : undefined

const socketInstance = io(socketUrl, {
  path: '/socket.io/',           // ⚠️ 必須與後端一致
  transports: ['polling', 'websocket'],  // 先 polling 再升級
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  timeout: 20000,
  autoConnect: true,
})
```

**重要**: 開發環境中，直接連接 `http://localhost:8000` 而非依賴 Vite 代理，因為 Vite 的 WebSocket 代理在某些情況下不穩定。

---

## 📡 通訊協定

### Client → Server 事件

#### 1. `start_session`
開始新的專注階段
```typescript
socket.emit('start_session', {
  duration_minutes: 25  // 專注時間（分鐘）
})
```

#### 2. `stop_session`
強制停止當前階段
```typescript
socket.emit('stop_session')
```

#### 3. `pause_session` / `resume_session`
暫停/恢復階段
```typescript
socket.emit('pause_session')
socket.emit('resume_session')
```

#### 4. `update_penalty_config`
更新違規懲罰配置
```typescript
socket.emit('update_penalty_config', {
  enable_phone_penalty: true,
  enable_presence_penalty: true,
  enable_noise_penalty: false,
  enable_box_open_penalty: true,
  presence_duration_sec: 10,
  noise_duration_sec: 3
})
```

#### 5. `update_penalty_settings`
更新全域懲罰設定
```typescript
socket.emit('update_penalty_settings', {
  enabled: true,  // 全域懲罰總開關
  // 其他設定...
})
```

#### 5. `toggle_mock_mode`
切換模擬硬體模式
```typescript
socket.emit('toggle_mock_mode', {
  enabled: true  // true=啟用模擬, false=使用實體硬體
})
```

#### 6. `mock_sensor_update`
(模擬模式限定) 透過 REST API `/api/hardware/mock/manual` 或 `/api/hardware/mock/state` 更新，不通過 Socket 事件。
詳見 `routers/hardware.py`。

### Server → Client 事件

> [!NOTE]
> 專注歷史紀錄 (Session History) 與統計數據 (Statistics) 透過 REST API (`/api/sessions/history`, `/api/sessions/statistics`) 獲取，不使用 Socket.IO 事件。

#### 1. `system_state`
系統狀態廣播（每 200ms 或狀態變化時）
```json
{
  "session": {
    "id": "uuid",
    "status": "IDLE" | "ACTIVE" | "PAUSED" | "VIOLATED" | "COMPLETED",
    "duration_minutes": 25,
    "start_time": "2025-12-22T10:00:00Z",
    "end_time": null,
    "violations": 0,
    "penalties_executed": 0
  },
  "hardware_state": "IDLE" | "PREPARING" | "FOCUSING" | "PAUSED" | "VIOLATION" | "ERROR",
  "phone_status": "LOCKED" | "REMOVED" | "UNKNOWN",
  "presence_status": "DETECTED" | "AWAY" | "UNKNOWN",
  "box_status": "CLOSED" | "OPEN" | "UNKNOWN",
  "noise_status": "QUIET" | "NOISY" | "UNKNOWN",
  "current_db": 45,
  "prepare_remaining_ms": 9500,
  "last_sensor_data": {
    "nfc_id": "PHONE_001",
    "box_open": false,
    "radar_presence": true,
    "mic_db": 45,
    "timestamp": 1703241600000
  },
  "penalty_config": { ... }
}
```

#### 2. `hardware_status`
硬體連線狀態
```json
{
  "connected": true,
  "mock_mode": false,
  "mock_state": {
    "phone_inserted": true,
    "person_present": true,
    "box_open": false
  },
  "nfc_detected": true,
  "ldr_detected": true,
  "hall_detected": true,    // KY-033 IR 感測器
  "ir_detected": true,
  "radar_detected": true,
  "lcd_detected": false,
  "hardware_state": "IDLE",
  "firmware_version": "1.0.0",
  "features": "hall,lcd,radar"
}
```

#### 3. `penalty_triggered`
懲罰執行通知
```json
{
  "type": "PHONE_REMOVED" | "PRESENCE_AWAY" | "BOX_OPEN",
  "timestamp": 1703241600000
}
```

#### 4. `hardware_state_change`
硬體狀態機變更通知
```json
{
  "previous_state": "IDLE",
  "current_state": "PREPARING",
  "total_focus_time_ms": 0
}
```

#### 5. `penalty_level`
懲罰執行事件 (僅保留 PENALTY 單一層級)
```json
{
  "level": "PENALTY",
  "count": 1,
  "today_count": 5,
  "reason": "Phone removed",
  "action": "social_post"
}
```

#### 6. `penalty_state`
懲罰系統狀態變更通知
```json
{
  "type": "penalty_executed",
  "level": "PENALTY",
  "violation_count": 1,
  "today_violation_count": 5,
  "reason": "Phone removed"
}
```

### Hardware (ESP8266) → Server 事件

硬體透過專用 WebSocket 連接至 `/ws/hardware`

#### `sensor_data`
感測器數據上報（每 1 秒）
```json
{
  "state": "FOCUSING",
  "box_open": false,
  "radar_presence": true,
  "nfc_id": "PHONE_001",
  "mic_db": 45,
  "timestamp": 1703241600000,
  "nfc_detected": true,
  "ldr_detected": true
}
```

---

## 🔄 連線流程

### 成功連線的完整流程

```
1. 前端初始化
   ├─ useSocket hook 建立 Socket.IO client
   ├─ 連接到 http://localhost:8000 (開發環境)
   └─ 設定事件監聽器

2. Socket.IO 握手
   ├─ GET /socket.io/?EIO=4&transport=polling
   │  └─ 後端返回 session ID
   ├─ POST /socket.io/?EIO=4&transport=polling&sid=xxx
   │  └─ 客戶端發送 upgrade 請求
   └─ WebSocket /socket.io/?EIO=4&transport=websocket&sid=xxx
      └─ 升級為 WebSocket 連線 ✅

3. 後端處理 connect 事件
   ├─ 記錄客戶端 SID
   ├─ emit('system_state') → 發送初始狀態
   └─ emit('hardware_status') → 發送硬體狀態

4. 前端接收初始數據
   ├─ on('connect') → setConnected(true)
   ├─ on('system_state') → 更新系統狀態
   ├─ on('hardware_status') → 更新硬體狀態
   └─ fetch('/api/hardware/status') → 獲取額外資訊

5. 持續通訊
   ├─ 前端發送控制指令 (start_session, etc.)
   ├─ 後端定期廣播 system_state (200ms 節流)
   └─ 硬體上報 sensor_data → 後端處理 → 廣播更新
```

### 網路請求範例

**成功的握手序列**:
```http
GET /socket.io/?EIO=4&transport=polling&t=28vwpw73 HTTP/1.1
Host: localhost:8000
→ 200 OK
  Content-Type: text/plain
  0{"sid":"DjBLpr1Y048zJcPRAAAA","upgrades":["websocket"],...}

POST /socket.io/?EIO=4&transport=polling&t=28wiwni3&sid=DjBLpr1Y048zJcPRAAAA
→ 200 OK

WebSocket /socket.io/?EIO=4&transport=websocket&sid=DjBLpr1Y048zJcPRAAAA
→ 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
```

---

## 🔍 關鍵實作細節

### 1. Windows 相容性處理

**問題**: Windows 的 `asyncio` 預設使用 `SelectorEventLoop`，但 Playwright 和部分異步操作需要 `ProactorEventLoop`。

**解決方案**:
```python
# backend/run.py 和 backend/app/main.py
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
```

### 2. Windows Broken Pipe 處理

**問題**: 在 Windows 中以獨立視窗執行時，stdout 可能被關閉，導致 `print()` 拋出 `BrokenPipeError`。

**解決方案**:
```python
# backend/app/logger.py
def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, BrokenPipeError):
        pass  # 靜默忽略

# 全專案使用 safe_print 替代 print
from .logger import safe_print
safe_print("[LOG] Message")
```

### 3. API 路徑處理

**問題**: 前端直連後端時，相對路徑 `/api/*` 會指向前端伺服器。

**解決方案**:
```typescript
// frontend/src/hooks/useSocket.ts
const isDev = window.location.hostname === 'localhost'
const apiBase = isDev ? 'http://localhost:8000' : ''
fetch(`${apiBase}/api/hardware/status`)  // ✅ 絕對路徑
```

### 4. 狀態廣播節流

**問題**: 高頻率廣播會導致網路擁塞和性能問題。

**解決方案**:
```python
# backend/app/socket_manager.py
self.broadcast_throttle_ms = 200  # 最小 200ms 間隔

async def broadcast_state(self, force=False):
    now = datetime.now()
    if not force and self.last_broadcast_time:
        elapsed = (now - self.last_broadcast_time).total_seconds() * 1000
        if elapsed < self.broadcast_throttle_ms:
            return  # 跳過過於頻繁的廣播
    
    self.last_broadcast_time = now
    await self.sio.emit('system_state', self._serialize_state())
```

### 5. 多進程問題

**問題**: Uvicorn 的 `--workers > 1` 會導致 Socket.IO 狀態不同步。

**解決方案**:
```python
# backend/run.py
uvicorn.run(
    ...,
    workers=1,  # ⚠️ Socket.IO 必須使用單一進程
)
```

---

## 🐛 故障排除指南

### 問題 1: 前端顯示 "通訊中斷"

**症狀**:
- Header 顯示紅色 "通訊中斷"
- 瀏覽器 Console 有 `[WS] ❌ Connection error`

**診斷步驟**:
```powershell
# 1. 檢查後端是否運行
Invoke-RestMethod -Uri "http://localhost:8000/"
# 預期: {"name": "The Focus Enforcer v1.0", "status": "OPERATIONAL"}

# 2. 檢查 Socket.IO 狀態
Invoke-RestMethod -Uri "http://localhost:8000/test-socket"
# 預期: {"socket_io_active": true, "connected_clients": N}

# 3. 檢查端口佔用
netstat -ano | Select-String "8000|5173"
# 預期: 兩個端口都有 LISTENING
```

**常見原因與解決**:

1. **多個後端實例衝突**
   ```powershell
   # 關閉所有 Python 進程
   Get-Process python* | Stop-Process -Force
   
   # 重新啟動單一實例
   Start-Process -FilePath "D:/Coding/IoTProject/.venv/Scripts/python.exe" `
                 -ArgumentList "d:\Coding\IoTProject\backend\run.py" `
                 -WindowStyle Hidden
   ```

2. **前端連線配置錯誤**
   - 檢查 `useSocket.ts` 中的 `socketUrl` 是否正確
   - 開發環境應直連 `http://localhost:8000`

3. **版本不相容**
   ```powershell
   # 後端檢查
   pip show python-socketio  # 應為 5.11.0
   
   # 前端檢查
   npm list socket.io-client  # 應為 ^4.7.4
   ```

### 問題 2: 後端立即關閉

**症狀**:
- 啟動後立即退出
- 終端顯示 `[Errno 2] No such file or directory`

**解決**:
```powershell
# ❌ 錯誤: 相對路徑
cd backend
python run.py

# ✅ 正確: 絕對路徑
D:/Coding/IoTProject/.venv/Scripts/python.exe d:\Coding\IoTProject\backend\run.py
```

### 問題 3: WebSocket 握手失敗

**症狀**:
- Console: `WebSocket connection failed`
- 只有 polling，沒有升級到 WebSocket

**診斷**:
```javascript
// 瀏覽器 Console
socket.io.engine.transport.name  // 應為 'websocket'，不是 'polling'
```

**解決**:
1. 檢查 Vite proxy 配置的 `ws: true`
2. 檢查防火牆或反向代理設定
3. VS Code Simple Browser 對 WebSocket 支援有限，改用 Chrome/Firefox

### 問題 4: BrokenPipeError

**症狀**:
```
BrokenPipeError: [Errno 32] Broken pipe
```

**解決**:
- 確認所有 `print()` 已替換為 `safe_print()`
- 檢查檔案:
  - `backend/app/socket_manager.py`
  - `backend/app/main.py`
  - `backend/run.py`
  - `backend/app/routers/*.py`

### 問題 5: CORS 錯誤

**症狀**:
```
Access to XMLHttpRequest at 'http://localhost:8000' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**解決**:
```python
# backend/app/main.py
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # ⚠️ 生產環境改為具體域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🚀 開發環境設置

### 完整啟動流程

#### 1. 後端啟動
```powershell
# 方法 A: PowerShell 腳本（推薦）
.\Start-FocusEnforcer.ps1

# 方法 B: 手動啟動
D:/Coding/IoTProject/.venv/Scripts/python.exe d:\Coding\IoTProject\backend\run.py

# 方法 C: 背景執行
Start-Process -FilePath "D:/Coding/IoTProject/.venv/Scripts/python.exe" `
              -ArgumentList "d:\Coding\IoTProject\backend\run.py" `
              -WindowStyle Hidden
```

#### 2. 前端啟動
```powershell
cd frontend
npm run dev
# 或
cd d:\Coding\IoTProject\frontend
npm run dev
```

#### 3. 驗證連線
```powershell
# 後端健康檢查
curl http://localhost:8000/

# Socket.IO 檢查
curl http://localhost:8000/test-socket

# 前端訪問
Start-Process "http://localhost:5173"
```

### 環境變數配置

**檔案**: `backend/.env` (可選)
```env
# 伺服器配置
HOST=0.0.0.0
PORT=8000
DEBUG=False

# 硬體模式
MOCK_HARDWARE=False
MOCK_INTERVAL_MS=1000

# 社交媒體整合
GMAIL_SMTP_SERVER=smtp.gmail.com
GMAIL_SMTP_PORT=587
# ... (其他憑證)
```

### 依賴安裝

```powershell
# 後端
cd backend
pip install -r requirements.txt
playwright install  # 安裝瀏覽器驅動

# 前端
cd frontend
npm install
```

---

## 📊 連線狀態監控

### 後端日誌
```
======================================================================
Starting The Focus Enforcer v1.0
Host: 0.0.0.0:8000
Debug Mode: False
Mock Hardware: False
======================================================================
[Socket.IO] Server initialized
INFO:     Started server process [24304]
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     127.0.0.1:62347 - "GET /socket.io/?EIO=4&transport=polling&t=29hyq4ta HTTP/1.1" 200 OK
[WS] Client connected: VHNGvrRX04VYvofkAAAB
INFO:     ('127.0.0.1', 62729) - "WebSocket /socket.io/?EIO=4&transport=websocket&sid=DjBLpr1Y048zJcPRAAAA" [accepted]
INFO:     connection open
```

### 前端 Console
```javascript
[WS] Initializing Socket.IO client...
[WS] Connecting to: http://localhost:8000
[WS] Socket instance created
[WS] ✅ Connected to Focus Enforcer v1.0
[WS] Socket ID: DjBLpr1Y048zJcPRAAAA
[WS] Setting connected = true
[WS] Initial hardware status: {connected: true, mock_mode: false, ...}
```

### 健康檢查 API
```powershell
# 系統狀態
curl http://localhost:8000/ | ConvertFrom-Json

# Socket.IO 狀態
curl http://localhost:8000/test-socket | ConvertFrom-Json

# 硬體狀態
curl http://localhost:8000/api/hardware/status | ConvertFrom-Json
```

---

## 📝 重要注意事項

### ✅ 成功運行的關鍵要素

1. **單一後端實例**: 避免多進程競爭
2. **正確的事件循環**: Windows 必須使用 `ProactorEventLoop`
3. **版本相容性**: `python-socketio` 5.11.0 + `socket.io-client` 4.7.4
4. **直連後端**: 開發環境直接連接 `localhost:8000`，不依賴 Vite 代理
5. **安全列印**: 所有 `print()` 使用 `safe_print()` 包裝
6. **ASGI 整合**: 使用 `socketio.ASGIApp` 正確包裝 FastAPI
7. **路徑一致**: 前後端的 `path` 必須為 `/socket.io/`

### ⚠️ 常見陷阱

1. **不要使用多 worker**: `uvicorn --workers > 1` 會破壞 Socket.IO 狀態
2. **不要依賴 Simple Browser**: VS Code 內建瀏覽器對 WebSocket 支援有限
3. **不要混用事件循環**: 確保整個專案使用相同的事件循環策略
4. **不要在相對路徑中使用 API**: 直連時必須使用絕對 URL

---

## 🔗 參考資源

- [Socket.IO Server (Python) 文件](https://python-socketio.readthedocs.io/)
- [Socket.IO Client (JavaScript) 文件](https://socket.io/docs/v4/client-api/)
- [FastAPI WebSocket 文件](https://fastapi.tiangolo.com/advanced/websockets/)
- [Uvicorn 部署指南](https://www.uvicorn.org/deployment/)

---

**文件維護**: 當修改 Socket.IO 相關代碼時，請同步更新本文件。  
**驗證狀態**: 本文件基於 2025-12-22 的成功運行配置編寫。
