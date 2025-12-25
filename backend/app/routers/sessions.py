"""專注協定任務管理路由。"""
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from ..socket_manager import socket_manager
from ..models import SessionStatus
from ..logger import safe_print
from ..schemas import success_response
from ..session_store import session_store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# 定義人質照片存放路徑
HOSTAGE_DIR = Path(__file__).parent.parent.parent / "hostage_evidence"
HOSTAGE_DIR.mkdir(parents=True, exist_ok=True)


class StartSessionRequest(BaseModel):
    """啟動任務的請求模型。"""
    duration_minutes: int = 25


def get_hostage_path() -> Path:
    """獲取當前人質照片的存放路徑。"""
    return HOSTAGE_DIR / "hostage.jpg"


def save_hostage_image(file: UploadFile) -> str:
    """將上傳的人質照片儲存至磁碟，並回傳儲存路徑。"""
    hostage_path = get_hostage_path()
    with open(hostage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    safe_print(f"[人質協定] 人質照片已就緒，路徑: {hostage_path}")
    return str(hostage_path)


def delete_hostage_image():
    """任務圓滿達成後，銷毀人質照片。"""
    hostage_path = get_hostage_path()
    if hostage_path.exists():
        os.remove(hostage_path)
        safe_print("[人質協定] 專注成功！人質照片已按規定銷毀。")


def get_hostage_image_if_exists() -> Optional[str]:
    """若人質照片存在，則回傳其路徑。"""
    hostage_path = get_hostage_path()
    if hostage_path.exists():
        return str(hostage_path)
    return None


@router.post("/start")
async def start_session(
    duration_minutes: int = Form(default=25),
    hostage_image: Optional[UploadFile] = File(default=None)
):
    """啟動新的專注任務，支援選填的人質照片上傳。"""
    # 檢查是否已有任務在進行中
    if socket_manager.state.session and socket_manager.state.session.status == SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="目前的專注任務尚未結束，無法開啟新任務。")

    hostage_path = None
    if hostage_image and hostage_image.filename:
        hostage_path = save_hostage_image(hostage_image)

    # 調用核心控制器啟動任務
    await socket_manager.start_focus_session(duration_minutes, hostage_path)

    return success_response({
        "session_id": socket_manager.state.session.id if socket_manager.state.session else None,
        "penalty_state": socket_manager.state.penalty_state.dict() if socket_manager.state.penalty_state else None
    }, message=f"專注協定啟動：預計專注 {duration_minutes} 分鐘。")


@router.post("/stop")
async def stop_session():
    """強制結束或提前完成當前專注任務。"""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="目前沒有正在執行的專注任務。")

    # 判斷是否為「正常」完成（未處於違規狀態）
    session_completed = socket_manager.state.session.status != SessionStatus.VIOLATED
    await socket_manager.stop_focus_session()

    # 任務完成後，移除人質照片
    if session_completed:
        delete_hostage_image()

    message = "專注任務已圓滿結束。" if session_completed else "專注任務已因違規而被中止。"
    return success_response(message=message)


@router.post("/pause")
async def pause_session():
    """暫停目前的專注任務 (v1.0 新增)。"""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="目前沒有正在執行的專注任務。")

    if socket_manager.state.session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="任務目前並未處於執行狀態，無法暫停。")

    await socket_manager.pause_focus_session()

    return success_response({
        "session_id": socket_manager.state.session.id if socket_manager.state.session else None
    }, message="專注任務已暫停。")


@router.post("/resume")
async def resume_session():
    """恢復先前暫停的專注任務 (v1.0 新增)。"""
    if not socket_manager.state.session:
        raise HTTPException(status_code=400, detail="目前沒有正在執行的專注任務。")

    if socket_manager.state.session.status != SessionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="任務目前並未處於暫停狀態。")

    await socket_manager.resume_focus_session()

    return success_response({
        "session_id": socket_manager.state.session.id if socket_manager.state.session else None
    }, message="專注任務已恢復執行。")


@router.get("/current")
async def get_current_session():
    """查詢當前任務的詳細狀態與環境監測數據。"""
    return success_response({
        "session": socket_manager.state.session.model_dump() if socket_manager.state.session else None,
        "phone_status": socket_manager.state.phone_status,
        "presence_status": socket_manager.state.presence_status,
        "current_db": socket_manager.state.current_db,
        "hardware_state": socket_manager.state.hardware_state.value,
        "hostage_uploaded": get_hostage_image_if_exists() is not None
    })


@router.get("/hostage-status")
async def get_hostage_status():
    """檢查目前「人質協定」的執行狀態 (照片是否已上傳)。"""
    hostage_path = get_hostage_image_if_exists()
    return success_response({
        "has_hostage": hostage_path is not None
    }, message="人質照片已上傳，協定生效中。" if hostage_path else "尚未偵測到上傳的人質照片。")


@router.get("/history")
async def get_session_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None)
):
    """查詢歷史專注紀錄清單。

    參數：
        limit: 每頁返回數量 (預設 20，最大 100)
        offset: 跳過的數量 (分頁偏移)
        status: 狀態過濾條件 (COMPLETED, VIOLATED, CANCELLED)
    """
    records = session_store.get_history(
        limit=limit,
        offset=offset,
        status_filter=status
    )

    return success_response({
        "sessions": [r.model_dump() for r in records],
        "total": len(session_store._history),
        "limit": limit,
        "offset": offset
    })


@router.get("/statistics")
async def get_session_statistics():
    """查詢專注成效統計 (完成率、累計專注時間等)。"""
    stats = session_store.get_statistics()
    return success_response(stats)

