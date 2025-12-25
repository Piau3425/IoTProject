"""硬體控制與狀態查詢路由。"""
from fastapi import APIRouter
from pydantic import BaseModel

from ..socket_manager import socket_manager
from ..schemas import success_response

router = APIRouter(prefix="/api/hardware", tags=["hardware"])


class MockControlRequest(BaseModel):
    """控置模擬模式的請求模型。"""
    enabled: bool


@router.get("/status")
async def get_hardware_status():
    """獲取當前硬體連線狀態與感測器偵測情形 (v1.0)。"""
    # 呼叫輔助方法以取得一致的感測器偵測狀態
    nfc_detected, ldr_detected, radar_detected = socket_manager.get_sensor_detection_status()

    return success_response({
        "connected": socket_manager.hardware_connected,
        "mock_mode": socket_manager.mock_mode_active,
        "mock_state": socket_manager.mock_state.to_dict(),
        "last_sensor_data": socket_manager.state.last_sensor_data.model_dump()
            if socket_manager.state.last_sensor_data else None,
        "nfc_detected": nfc_detected,
        "ldr_detected": ldr_detected,
        "hall_detected": ldr_detected,  # v1.0：霍爾感測器與 LDR 共用邏輯位
        "ir_detected": ldr_detected,    # 提供 ir_detected 以維持前端相容性
        "radar_detected": radar_detected,
        "lcd_detected": 'lcd' in socket_manager.hardware_features,
        "hardware_state": socket_manager.state.hardware_state.value,
        "firmware_version": socket_manager.hardware_firmware_version
    })


@router.post("/mock/start")
async def start_mock_hardware():
    """啟動虛擬硬體模擬模式。"""
    await socket_manager.start_mock_hardware()
    return success_response(message="已進入硬體模擬模式")


@router.post("/mock/stop")
async def stop_mock_hardware():
    """停止虛擬硬體模擬模式，切換回實體連線。"""
    await socket_manager.stop_mock_hardware()
    return success_response(message="模擬模式已關閉")


@router.post("/command/lock")
async def send_lock_command():
    """向實體硬體發送鎖定指令。"""
    await socket_manager.sio.emit('command', {'command': 'LOCK_BOX'})
    return success_response({"command": "LOCK_BOX"})


@router.post("/command/unlock")
async def send_unlock_command():
    """向實體硬體發送解鎖指令。"""
    await socket_manager.sio.emit('command', {'command': 'UNLOCK_BOX'})
    return success_response({"command": "UNLOCK_BOX"})


class ManualSensorData(BaseModel):
    """手動設定模擬感測器數據的模型。"""
    phone_inserted: bool
    person_present: bool
    nfc_valid: bool = True
    box_open: bool = False
    noise_min: int = 35
    noise_max: int = 55


class MockStateUpdate(BaseModel):
    """更新特定模擬欄位的模型。"""
    phone_inserted: bool | None = None
    person_present: bool | None = None
    nfc_valid: bool | None = None
    box_locked: bool | None = None
    box_open: bool | None = None
    noise_min: int | None = None
    noise_max: int | None = None


@router.post("/mock/manual")
async def send_manual_sensor_data(data: ManualSensorData):
    """固定模擬硬體的感測器狀態。設定後狀態將保持不變直到手動更改。"""
    new_state = await socket_manager.set_mock_state(
        phone_inserted=data.phone_inserted,
        person_present=data.person_present,
        nfc_valid=data.nfc_valid,
        box_locked=data.phone_inserted,  # box_locked 狀態隨 phone_inserted 變化
        box_open=data.box_open,
        noise_min=data.noise_min,
        noise_max=data.noise_max
    )

    return success_response(new_state, message="虛擬狀態已更新 (持久化)")


@router.post("/mock/state")
async def update_mock_state(data: MockStateUpdate):
    """僅針對特定的虛擬硬體欄位進行更新。"""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    new_state = await socket_manager.set_mock_state(**updates)
    return success_response(new_state)


@router.get("/mock/state")
async def get_mock_state():
    """查詢當前虛擬硬體的內部狀態。"""
    return success_response({
        "mock_mode_active": socket_manager.mock_mode_active,
        "mock_state": socket_manager.mock_state.to_dict()
    })
