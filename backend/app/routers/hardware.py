from fastapi import APIRouter
from pydantic import BaseModel

from ..socket_manager import socket_manager

router = APIRouter(prefix="/api/hardware", tags=["hardware"])


class MockControlRequest(BaseModel):
    enabled: bool


@router.get("/status")
async def get_hardware_status():
    """Get current hardware connection status (v1.0)."""
    # Use helper method to get consistent sensor detection status
    nfc_detected, ldr_detected, radar_detected = socket_manager.get_sensor_detection_status()
    
    return {
        "connected": socket_manager.hardware_connected,
        "mock_mode": socket_manager.mock_mode_active,
        "mock_state": socket_manager.mock_state.to_dict(),
        "last_sensor_data": socket_manager.state.last_sensor_data.model_dump() 
            if socket_manager.state.last_sensor_data else None,
        "nfc_detected": nfc_detected,
        "ldr_detected": ldr_detected,
        "hall_detected": ldr_detected,  # v1.0: Hall sensor maps to ldr_detected
        "ir_detected": ldr_detected,    # Also provide ir_detected for frontend compatibility
        "radar_detected": radar_detected,
        "lcd_detected": 'lcd' in socket_manager.hardware_features,
        "hardware_state": socket_manager.state.hardware_state.value,
        "firmware_version": socket_manager.hardware_firmware_version
    }


@router.post("/mock/start")
async def start_mock_hardware():
    """Start mock hardware simulation."""
    await socket_manager.start_mock_hardware()
    return {"success": True, "message": "Mock hardware started"}


@router.post("/mock/stop")
async def stop_mock_hardware():
    """Stop mock hardware simulation."""
    await socket_manager.stop_mock_hardware()
    return {"success": True, "message": "Mock hardware stopped"}


@router.post("/command/lock")
async def send_lock_command():
    """Send lock command to hardware."""
    await socket_manager.sio.emit('command', {'command': 'LOCK_BOX'})
    return {"success": True, "command": "LOCK_BOX"}


@router.post("/command/unlock")
async def send_unlock_command():
    """Send unlock command to hardware."""
    await socket_manager.sio.emit('command', {'command': 'UNLOCK_BOX'})
    return {"success": True, "command": "UNLOCK_BOX"}


class ManualSensorData(BaseModel):
    phone_inserted: bool
    person_present: bool
    nfc_valid: bool = True
    box_open: bool = False


class MockStateUpdate(BaseModel):
    phone_inserted: bool | None = None
    person_present: bool | None = None
    nfc_valid: bool | None = None
    box_locked: bool | None = None
    box_open: bool | None = None


@router.post("/mock/manual")
async def send_manual_sensor_data(data: ManualSensorData):
    """Set persistent mock hardware state. State persists until changed."""
    # Update persistent mock state
    new_state = await socket_manager.set_mock_state(
        phone_inserted=data.phone_inserted,
        person_present=data.person_present,
        nfc_valid=data.nfc_valid,
        box_locked=data.phone_inserted,  # box_locked follows phone_inserted
        box_open=data.box_open
    )
    
    return {
        "success": True, 
        "message": "Mock state updated (persistent)", 
        "mock_state": new_state
    }


@router.post("/mock/state")
async def update_mock_state(data: MockStateUpdate):
    """Update specific mock hardware state fields."""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    new_state = await socket_manager.set_mock_state(**updates)
    return {"success": True, "mock_state": new_state}


@router.get("/mock/state")
async def get_mock_state():
    """Get current mock hardware state."""
    return {
        "mock_mode_active": socket_manager.mock_mode_active,
        "mock_state": socket_manager.mock_state.to_dict()
    }
