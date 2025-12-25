"""
專案名稱：THE FOCUS ENFORCER v1.0
================================
零信任專注力監控系統與社交懲罰機制

這是一個結合硬體與軟體的整合系統，旨在透過「零信任」監控和「社交羞辱」協議來強制執行專注。
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio
import uvicorn
import json
from datetime import datetime

# 為 Windows 系統進行修正 - Playwright 在 Windows 上所有 Python 版本都要求使用 ProactorEventLoop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from .config import settings
from .logger import safe_print
from .socket_manager import socket_manager
from .automation.social_manager import social_manager
from .routers import sessions, social, hardware, hostage, penalty
from .exceptions import FocusEnforcerError
from .schemas import success_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 應用程式生命週期處理程序，負責啟動與關閉時的清理工作
    safe_print("=" * 65)
    safe_print(" " * 10 + "THE FOCUS ENFORCER v1.0")
    safe_print(" " * 5 + "零信任監控模式 | 社交羞辱協議啟動")
    safe_print(" " * 10 + "API 直接整合已就緒")
    safe_print("=" * 65)

    # 將社交管理器註冊為懲罰回呼函式（直接 API 整合）
    socket_manager.register_penalty_callback(social_manager.execute_penalty)

    # 如果設定中開啟了模擬模式，則啟動虛擬硬體
    if settings.MOCK_HARDWARE:
        safe_print("[系統] 已啟用硬體模擬模式 - 正在啟動模擬程式...")
        await socket_manager.start_mock_hardware()

    safe_print(f"[系統] 伺服器運行於 http://{settings.HOST}:{settings.PORT}")
    safe_print(f"[系統] Socket.IO 端點: http://{settings.HOST}:{settings.PORT}/socket.io/")
    safe_print(f"[系統] 直接整合服務: Gmail ✉️  | Threads 🧵")

    yield

    # 伺服器關閉時的清理流程
    safe_print("[系統] 正在關閉系統...")
    await socket_manager.stop_mock_hardware()
    await social_manager.shutdown()


# 初始化 FastAPI 應用程式
fastapi_app = FastAPI(
    title=settings.APP_NAME,
    description="具備社交懲罰機制的零信任專注力監控系統",
    version="1.0.0",
    lifespan=lifespan
)

# 設定 CORS 中間件，允許前端跨網域讀取
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 載入 API 請求日誌記錄與 Request ID 追蹤中間件
# pylint: disable=wrong-import-position
from .middleware import LoggingMiddleware, RequestIdMiddleware
fastapi_app.add_middleware(LoggingMiddleware)
fastapi_app.add_middleware(RequestIdMiddleware)

# =============================================================================
# 全域異常處理程序
# =============================================================================

@fastapi_app.exception_handler(FocusEnforcerError)
async def focus_enforcer_error_handler(request: Request, exc: FocusEnforcerError):
    # 處理自定義的 Focus Enforcer 異常，回傳統一的錯誤格式
    return JSONResponse(
        status_code=400,
        content=exc.to_dict()
    )


@fastapi_app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # 處理未預期的一般異常，確保系統不會直接噴錯，並保持回傳格式一致
    safe_print(f"[錯誤] 捕捉到未處理的異常: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "發生未預期的系統錯誤",
            "details": {"exception": str(exc)} if settings.DEBUG else {}
        }
    )


# 註冊 API 路由模組
fastapi_app.include_router(sessions.router)
fastapi_app.include_router(social.router)
fastapi_app.include_router(hardware.router)
fastapi_app.include_router(hostage.router)
fastapi_app.include_router(penalty.router)

# Socket.IO 整合 - 使用 Socket.IO 包裝 FastAPI 應用程式
# 這是 python-socketio 與 FastAPI 配合的標準做法
app = socketio.ASGIApp(
    socket_manager.sio,
    other_asgi_app=fastapi_app,
    socketio_path='socket.io'  # 注意：此處路徑開頭不加斜線！
)


@fastapi_app.get("/test-socket")
async def test_socket():
    # 用於驗證 Socket.IO 伺服器狀態的測試端點
    return {
        "socket_io_active": True,
        "connected_clients": len(socket_manager.connected_clients),
        "mock_mode": socket_manager.mock_mode_active,
        "hardware_connected": socket_manager.hardware_connected
    }


@fastapi_app.websocket("/ws/hardware")
async def hardware_websocket(websocket: WebSocket):
    # D1-mini 硬體專用的原生 WebSocket 端點
    await websocket.accept()
    hardware_id = "UNKNOWN"
    hardware_registered = False  # 用來追蹤是否已經收到 hardware_connect 事件
    safe_print(f"[硬體 WS] ✅ D1-mini 已從 {websocket.client} 連線")

    # 標記實體硬體 WebSocket 為已連線
    socket_manager.physical_hardware_ws_connected = True

    # 如果目前處於模擬模式，我們雖然接受連線，但會忽略所有的輸入數據
    if socket_manager.mock_mode_active:
        safe_print("[硬體 WS] ⚠️ 目前為模擬模式 - 將忽略實體硬體傳來的數據")
    else:
        # 立即設定硬體已連線，但感測器資訊需等待 hardware_connect 事件確認
        socket_manager.hardware_connected = True

    try:
        while True:
            # 從 D1-mini 接收感測器數據
            try:
                data_str = await websocket.receive_text()
            except Exception as e:
                safe_print(f"[硬體 WS] 接收數據時發生錯誤: {e}")
                break

            # 模擬模式下直接跳過後續處理
            if socket_manager.mock_mode_active:
                continue

            try:
                raw_data = json.loads(data_str)
            except json.JSONDecodeError as e:
                safe_print(f"[硬體 WS] JSON 解析失敗: {e}")
                continue

            # 解析 Socket.IO 格式的數據包: ["event_name", {data}]
            if isinstance(raw_data, list) and len(raw_data) >= 2:
                event_name = raw_data[0]
                event_data = raw_data[1]
            elif isinstance(raw_data, dict):
                # 兼容字典格式
                event_name = raw_data.get('event', 'sensor_data')
                event_data = raw_data
            else:
                if settings.DEBUG:
                    safe_print(f"[硬體 WS] 未知的數據格式: {type(raw_data)}")
                continue

            # 檢查是否為心跳包或硬體連線事件
            if event_name == 'heartbeat':
                # 心跳包現在靜默處理，不記錄在日誌中
                continue
            elif event_name == 'hardware_connect':
                hardware_id = event_data.get('hardware_id', 'UNKNOWN')
                board = event_data.get('board', 'D1-mini')
                version = event_data.get('version', '1.0')
                nfc_detected = event_data.get('nfc_detected', True)
                gyro_detected = event_data.get('gyro_detected', True)
                radar_detected = event_data.get('radar_detected', True)
                safe_print(f"[硬體 WS] 💻 {hardware_id} | {board} v{version} | NFC: {nfc_detected} | Gyro: {gyro_detected} | 雷達: {radar_detected}")

                # 更新實體硬體的感測器偵測狀態
                socket_manager.hardware_connected = True
                socket_manager.physical_nfc_detected = nfc_detected
                socket_manager.physical_gyro_detected = gyro_detected
                socket_manager.physical_radar_detected = radar_detected
                hardware_registered = True

                # 向前端廣播包含感測器資訊的最新硬體狀態
                await socket_manager.broadcast_event('hardware_status', {
                    'connected': True,
                    'mock_mode': False,
                    'hardware_id': hardware_id,
                    'version': version,
                    'board': board,
                    'nfc_detected': nfc_detected,
                    'gyro_detected': gyro_detected,
                    'ldr_detected': gyro_detected,
                    'hall_detected': gyro_detected,
                    'ir_detected': gyro_detected,
                    'radar_detected': radar_detected,
                    'lcd_detected': False,
                    'mock_state': socket_manager.mock_state.to_dict()
                })
                continue

            # 處理一般感測器數據
            if event_name == 'sensor_data':
                # 若硬體尚未發送註冊事件，先從數據中嘗試提取感測器配置資訊
                if not hardware_registered:
                    nfc_det = event_data.get('nfc_detected', True)
                    gyro_det = event_data.get('gyro_detected', True)
                    radar_det = event_data.get('radar_detected', True)
                    socket_manager.physical_nfc_detected = nfc_det
                    socket_manager.physical_gyro_detected = gyro_det
                    socket_manager.physical_radar_detected = radar_det
                    hardware_registered = True

                    # 廣播基於感測器數據的初步狀態
                    await socket_manager.broadcast_event('hardware_status', {
                        'connected': True,
                        'mock_mode': False,
                        'hardware_id': event_data.get('hardware_id', 'UNKNOWN'),
                        'nfc_detected': nfc_det,
                        'gyro_detected': gyro_det,
                        'ldr_detected': gyro_det,
                        'hall_detected': gyro_det,
                        'ir_detected': gyro_det,
                        'radar_detected': radar_det,
                        'lcd_detected': False,
                        'mock_state': socket_manager.mock_state.to_dict()
                    })

                now = datetime.now()
                last_log = socket_manager.last_log_time.get('hw_sensor_data')
                # 每 5 秒輸出一次感測器數據流日誌，避免刷頻
                if last_log is None or (now - last_log).total_seconds() >= 5.0:
                    safe_print(f"[硬體 WS] 📊 感測器數據傳輸中...")
                    socket_manager.last_log_time['hw_sensor_data'] = now

            # 交由 socket_manager 處理核心感測邏輯
            await socket_manager.process_sensor_data(event_data)

    except WebSocketDisconnect:
        safe_print(f"[硬體 WS] 🔌 硬體 {hardware_id} 已斷開連線")
    except Exception as e:
        safe_print(f"[硬體 WS] ❌ 發生錯誤: {e}")
    finally:
        # 清理工作：標記實體硬體 WebSocket 為斷開
        socket_manager.physical_hardware_ws_connected = False

        # 只有在非模擬模式下才更新全域狀態，避免模擬器數據受影響
        if not socket_manager.mock_mode_active:
            socket_manager.hardware_connected = False
            socket_manager.physical_nfc_detected = False
            socket_manager.physical_gyro_detected = False

            # 向前端廣播硬體斷連通知
            await socket_manager.broadcast_event('hardware_status', {
                'connected': False,
                'mock_mode': False,
                'mock_state': socket_manager.mock_state.to_dict(),
                'nfc_detected': False,
                'gyro_detected': False,
                'ldr_detected': False,
                'hall_detected': False,
                'ir_detected': False,
                'radar_detected': False,
                'lcd_detected': False
            })

        safe_print("[硬體 WS] ⏹️  連線已關閉")


@fastapi_app.get("/")
async def root():
    # 健康檢查端點，確認服務運行狀態
    return success_response({
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "OPERATIONAL",
        "hardware_connected": socket_manager.hardware_connected,
        "active_session": socket_manager.state.session is not None
    })


@fastapi_app.get("/api/state")
async def get_system_state():
    # 獲取完整系統狀態，包含當前專注階段與各項感測值
    state = socket_manager.state.model_dump()
    if socket_manager.state.session:
        if socket_manager.state.session.start_time:
            state['session']['start_time'] = socket_manager.state.session.start_time.isoformat()
        if socket_manager.state.session.end_time:
            state['session']['end_time'] = socket_manager.state.session.end_time.isoformat()
    if socket_manager.state.person_away_since:
        state['person_away_since'] = socket_manager.state.person_away_since.isoformat()
    return success_response(state)


@fastapi_app.get("/api/system/compatibility-check")
async def check_compatibility():
    # 檢查系統各組件的版本相容性
    # 回傳 Socket.IO 伺服器版本與建議的前端客戶端版本
    import socketio as sio_module

    server_version = sio_module.__version__

    # 根據已知正常運作的版本判斷相容性
    # python-socketio 5.x 與 socket.io-client 4.x 配合良好
    major_version = int(server_version.split('.')[0])

    if major_version == 5:
        recommended_client = "^4.7.4"
        compatibility_status = "✅ 已相容 (COMPATIBLE)"
    elif major_version == 4:
        recommended_client = "^3.x"
        compatibility_status = "⚠️ 舊版本 (LEGACY)"
    else:
        recommended_client = "unknown"
        compatibility_status = "❓ 未知狀態 (UNKNOWN)"

    return success_response({
        "server": {
            "name": "python-socketio",
            "version": server_version,
            "engine_io": "v4"
        },
        "recommended_client": {
            "package": "socket.io-client",
            "version": recommended_client
        },
        "compatibility_status": compatibility_status,
        "notes": [
            "前端 socket.io-client 版本必須與伺服器 Engine.IO 版本相符",
            "python-socketio 5.x 使用的是 Engine.IO v4",
            "疑難排解請參閱 SOCKET_COMMUNICATION.md"
        ]
    })

if __name__ == "__main__":
    # 啟動 Uvicorn 伺服器
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
