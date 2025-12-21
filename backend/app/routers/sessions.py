from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import os
import shutil
from pathlib import Path

from ..socket_manager import socket_manager
from ..models import SessionStatus

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

HOSTAGE_DIR = Path(__file__).parent.parent.parent / "hostage_evidence"
HOSTAGE_DIR.mkdir(parents=True, exist_ok=True)


class StartSessionRequest(BaseModel):
    duration_minutes: int = 25


class SessionResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[str] = None


def get_hostage_path() -> Path:
    """Get the path to the current hostage image."""
    return HOSTAGE_DIR / "hostage.jpg"


def save_hostage_image(file: UploadFile) -> str:
    """Save the uploaded hostage image and return its path."""
    hostage_path = get_hostage_path()
    with open(hostage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print(f"[人質協定] 人質照片已儲存: {hostage_path}")
    return str(hostage_path)


def delete_hostage_image():
    """Delete the hostage image after successful session completion."""
    hostage_path = get_hostage_path()
    if hostage_path.exists():
        os.remove(hostage_path)
        print("[人質協定] 任務完成，人質照片已銷毀")


def get_hostage_image_if_exists() -> Optional[str]:
    """Return the hostage image path if it exists."""
    hostage_path = get_hostage_path()
    if hostage_path.exists():
        return str(hostage_path)
    return None


@router.post("/start", response_model=SessionResponse)
async def start_session(
    duration_minutes: int = Form(default=25),
    hostage_image: Optional[UploadFile] = File(default=None)
):
    """Start a new focus session with optional hostage image upload."""
    if socket_manager.state.session and socket_manager.state.session.status == SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="專注協定執行中，無法啟動新任務")
    
    hostage_path = None
    if hostage_image and hostage_image.filename:
        hostage_path = save_hostage_image(hostage_image)
    
    await socket_manager.start_focus_session(duration_minutes, hostage_path)
    
    return SessionResponse(
        success=True,
        message=f"專注協定已啟動：{duration_minutes} 分鐘",
        session_id=socket_manager.state.session.id if socket_manager.state.session else None
    )


@router.post("/stop", response_model=SessionResponse)
async def stop_session():
    """Stop the current focus session."""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="無進行中的專注協定")
    
    session_completed = socket_manager.state.session.status != SessionStatus.VIOLATED
    await socket_manager.stop_focus_session()
    
    if session_completed:
        delete_hostage_image()
    
    return SessionResponse(
        success=True,
        message="專注協定已終止" if session_completed else "專注協定已中止（違規狀態）"
    )


@router.post("/pause", response_model=SessionResponse)
async def pause_session():
    """Pause the current focus session (v1.0 new feature)."""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="無進行中的專注協定")
    
    if socket_manager.state.session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="專注協定不在執行狀態")
    
    await socket_manager.pause_focus_session()
    
    return SessionResponse(
        success=True,
        message="專注協定已暫停",
        session_id=socket_manager.state.session.id if socket_manager.state.session else None
    )


@router.post("/resume", response_model=SessionResponse)
async def resume_session():
    """Resume a paused focus session (v1.0 new feature)."""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="無進行中的專注協定")
    
    if socket_manager.state.session.status != SessionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="專注協定不在暫停狀態")
    
    await socket_manager.resume_focus_session()
    
    return SessionResponse(
        success=True,
        message="專注協定已恢復",
        session_id=socket_manager.state.session.id if socket_manager.state.session else None
    )


@router.get("/current")
async def get_current_session():
    """Get the current session state."""
    return {
        "session": socket_manager.state.session.model_dump() if socket_manager.state.session else None,
        "phone_status": socket_manager.state.phone_status,
        "presence_status": socket_manager.state.presence_status,
        "current_db": socket_manager.state.current_db,
        "hardware_state": socket_manager.state.hardware_state.value,
        "hostage_uploaded": get_hostage_image_if_exists() is not None
    }


@router.get("/hostage-status")
async def get_hostage_status():
    """Check if a hostage image is currently uploaded."""
    hostage_path = get_hostage_image_if_exists()
    return {
        "has_hostage": hostage_path is not None,
        "message": "人質照片已就位" if hostage_path else "尚未上傳人質照片"
    }
