"""
THE FOCUS ENFORCER v1.0
========================
Zero-Trust Focus Monitoring with Social Shaming Enforcement

A hardware-software integrated system designed to enforce focus through
"Zero-Trust" monitoring and "Social Shaming" penalties.
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import socketio
import uvicorn
import json
from datetime import datetime

# Fix for Windows - Playwright requires ProactorEventLoop on all Python versions
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from .config import settings
from .logger import safe_print
from .socket_manager import socket_manager
from .automation.social_manager import social_manager
from .routers import sessions, social, hardware, hostage


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    safe_print("=" * 65)
    safe_print(" " * 10 + "THE FOCUS ENFORCER v1.0")
    safe_print(" " * 5 + "Zero-Trust Monitoring | Social Shame Protocol")
    safe_print(" " * 10 + "Direct API Integration")
    safe_print("=" * 65)
    
    # Register social manager as penalty callback (Direct API integration)
    socket_manager.register_penalty_callback(social_manager.execute_penalty)
    
    # Start mock hardware if configured
    if settings.MOCK_HARDWARE:
        safe_print("[SYSTEM] Mock hardware mode enabled - starting simulation...")
        await socket_manager.start_mock_hardware()
    
    safe_print(f"[SYSTEM] Server running at http://{settings.HOST}:{settings.PORT}")
    safe_print(f"[SYSTEM] Socket.IO endpoint: http://{settings.HOST}:{settings.PORT}/socket.io/")
    safe_print(f"[SYSTEM] Direct integrations: Gmail ✉️  | Threads 🧵")
    
    yield
    
    # Cleanup
    safe_print("[SYSTEM] Shutting down...")
    await socket_manager.stop_mock_hardware()
    await social_manager.shutdown()


# Create FastAPI app
fastapi_app = FastAPI(
    title=settings.APP_NAME,
    description="Zero-Trust Focus Monitoring with Social Shaming Enforcement",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(sessions.router)
fastapi_app.include_router(social.router)
fastapi_app.include_router(hardware.router)
fastapi_app.include_router(hostage.router)

# Socket.IO integration - Wrap FastAPI app with Socket.IO
# This is the CORRECT way for python-socketio with FastAPI
app = socketio.ASGIApp(
    socket_manager.sio,
    other_asgi_app=fastapi_app,
    socketio_path='socket.io'  # Path WITHOUT leading slash!
)


@fastapi_app.get("/test-socket")
async def test_socket():
    """Test endpoint to verify Socket.IO server status."""
    return {
        "socket_io_active": True,
        "connected_clients": len(socket_manager.connected_clients),
        "mock_mode": socket_manager.mock_mode_active,
        "hardware_connected": socket_manager.hardware_connected
    }


@fastapi_app.websocket("/ws/hardware")
async def hardware_websocket(websocket: WebSocket):
    """Native WebSocket endpoint for D1-mini hardware."""
    await websocket.accept()
    hardware_id = "UNKNOWN"
    hardware_registered = False  # Track if hardware_connect event was received
    safe_print(f"[HARDWARE WS] ✅ D1-mini connected from {websocket.client}")
    
    # Mark physical hardware WebSocket as connected
    socket_manager.physical_hardware_ws_connected = True
    
    # If mock mode is active, we still accept connection but ignore all data
    if socket_manager.mock_mode_active:
        safe_print("[HARDWARE WS] ⚠️ Mock mode active - physical hardware data will be ignored")
    else:
        # Set hardware connected immediately, but wait for hardware_connect event for sensor info
        socket_manager.hardware_connected = True
    
    try:
        while True:
            # Receive sensor data from D1-mini
            try:
                data_str = await websocket.receive_text()
            except Exception as e:
                safe_print(f"[HARDWARE WS] Error receiving data: {e}")
                break
            
            # If mock mode is active, ignore all physical hardware data
            if socket_manager.mock_mode_active:
                continue
            
            try:
                raw_data = json.loads(data_str)
            except json.JSONDecodeError as e:
                safe_print(f"[HARDWARE WS] JSON decode error: {e}")
                continue
            
            # Parse Socket.IO format: ["event_name", {data}]
            if isinstance(raw_data, list) and len(raw_data) >= 2:
                event_name = raw_data[0]
                event_data = raw_data[1]
            elif isinstance(raw_data, dict):
                # Fallback for dict format
                event_name = raw_data.get('event', 'sensor_data')
                event_data = raw_data
            else:
                if settings.DEBUG:
                    safe_print(f"[HARDWARE WS] Unknown data format: {type(raw_data)}")
                continue
            
            # Check if it's a heartbeat or hardware_connect event
            if event_name == 'heartbeat':
                # Heartbeats are now silent - no logging
                continue
            elif event_name == 'hardware_connect':
                hardware_id = event_data.get('hardware_id', 'UNKNOWN')
                board = event_data.get('board', 'D1-mini')
                version = event_data.get('version', '1.0')
                nfc_detected = event_data.get('nfc_detected', True)
                gyro_detected = event_data.get('gyro_detected', True)
                radar_detected = event_data.get('radar_detected', True)
                safe_print(f"[HARDWARE WS] 💻 {hardware_id} | {board} v{version} | NFC: {nfc_detected} | Gyro: {gyro_detected} | Radar: {radar_detected}")
                
                # Update physical hardware sensor detection status
                socket_manager.hardware_connected = True
                socket_manager.physical_nfc_detected = nfc_detected
                socket_manager.physical_gyro_detected = gyro_detected
                socket_manager.physical_radar_detected = radar_detected
                hardware_registered = True
                
                # Broadcast updated hardware status with sensor info
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
            
            # Process sensor data
            if event_name == 'sensor_data':
                # If hardware hasn't registered yet, extract sensor info from data
                if not hardware_registered:
                    nfc_det = event_data.get('nfc_detected', True)
                    gyro_det = event_data.get('gyro_detected', True)
                    radar_det = event_data.get('radar_detected', True)
                    socket_manager.physical_nfc_detected = nfc_det
                    socket_manager.physical_gyro_detected = gyro_det
                    socket_manager.physical_radar_detected = radar_det
                    hardware_registered = True
                    
                    # Broadcast initial status from sensor data
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
                if last_log is None or (now - last_log).total_seconds() >= 5.0:  # Log every 5 seconds
                    safe_print(f"[HARDWARE WS] 📊 Sensor data flowing...")
                    socket_manager.last_log_time['hw_sensor_data'] = now
            
            await socket_manager.process_sensor_data(event_data)
            
    except WebSocketDisconnect:
        safe_print(f"[HARDWARE WS] 🔌 {hardware_id} disconnected")
    except Exception as e:
        safe_print(f"[HARDWARE WS] ❌ Error: {e}")
    finally:
        # Mark physical hardware WebSocket as disconnected
        socket_manager.physical_hardware_ws_connected = False
        
        # Only update status if mock mode is not active
        if not socket_manager.mock_mode_active:
            socket_manager.hardware_connected = False
            socket_manager.physical_nfc_detected = False
            socket_manager.physical_gyro_detected = False
            
            # Broadcast hardware disconnect
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
        
        safe_print("[HARDWARE WS] ⏹️  Connection closed")


@fastapi_app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "OPERATIONAL",
        "hardware_connected": socket_manager.hardware_connected,
        "active_session": socket_manager.state.session is not None
    }


@fastapi_app.get("/api/state")
async def get_system_state():
    """Get complete system state."""
    state = socket_manager.state.model_dump()
    if socket_manager.state.session:
        if socket_manager.state.session.start_time:
            state['session']['start_time'] = socket_manager.state.session.start_time.isoformat()
        if socket_manager.state.session.end_time:
            state['session']['end_time'] = socket_manager.state.session.end_time.isoformat()
    if socket_manager.state.person_away_since:
        state['person_away_since'] = socket_manager.state.person_away_since.isoformat()
    return state


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
