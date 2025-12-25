"""人質協定證據管理路由。"""
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..logger import safe_print

router = APIRouter(prefix="/api/hostage", tags=["hostage"])

# 定義人質照片存放目錄
HOSTAGE_DIR = Path(__file__).parent.parent.parent / "hostage_evidence"
HOSTAGE_DIR.mkdir(parents=True, exist_ok=True)

# 中繼資料檔案路徑與最大圖片數量限制
METADATA_FILE = HOSTAGE_DIR / "metadata.json"
MAX_IMAGES = 30


class HostageImage(BaseModel):
    """單張人質照片的資料結構。"""
    id: str
    filename: str
    selected: bool
    url: str


class HostageListResponse(BaseModel):
    """照片清單回傳模型。"""
    images: List[HostageImage]
    total: int
    selected_count: int


def load_metadata() -> dict:
    """從 JSON 檔案載入照片中繼資料，用於維護選取狀態與原始名稱。"""
    if METADATA_FILE.exists():
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_metadata(metadata: dict):
    """將最新的照片中繼資料持久化至磁碟。"""
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def get_selected_images() -> List[str]:
    """獲取目前所有標記為「已選取」的照片實體路徑。"""
    metadata = load_metadata()
    selected = []
    for image_id, data in metadata.items():
        if data.get('selected', False):
            image_path = HOSTAGE_DIR / data['filename']
            if image_path.exists():
                selected.append(str(image_path))
    return selected


@router.get("/images", response_model=HostageListResponse)
async def list_images():
    """獲取所有已上傳照片的清單，含 ID 與預覽 URL。"""
    metadata = load_metadata()
    images = []
    selected_count = 0

    for image_id, data in metadata.items():
        image_path = HOSTAGE_DIR / data['filename']
        if image_path.exists():
            images.append(HostageImage(
                id=image_id,
                filename=data['filename'],
                selected=data.get('selected', False),
                url=f"/api/hostage/image/{image_id}"
            ))
            if data.get('selected', False):
                selected_count += 1

    return {
        "images": images,
        "total": len(images),
        "selected_count": selected_count
    }


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """上傳新的人質照片，作為違規時的處罰素材。"""
    # 嚴格檢查 MIME 類型
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="此功能僅支援上傳圖片檔案。")

    # 防止伺服器空間遭惡意佔用
    metadata = load_metadata()
    if len(metadata) >= MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"已達上傳上限，系統最多僅能保存 {MAX_IMAGES} 張人質照片。")

    # 使用 UUID 生成混淆過的檔名
    image_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    filename = f"{image_id}{file_ext}"
    file_path = HOSTAGE_DIR / filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"寫入檔案時發生錯誤：{str(e)}")

    # 新上傳的圖片預設為啟用狀態
    metadata[image_id] = {
        'filename': filename,
        'original_name': file.filename,
        'selected': True
    }
    save_metadata(metadata)

    safe_print(f"[人質協定] 成功接收新照片：{filename} (ID: {image_id})")

    return {
        "success": True,
        "data": {
            "image_id": image_id,
            "filename": filename
        },
        "message": "照片上傳成功。"
    }


@router.post("/toggle/{image_id}")
async def toggle_selection(image_id: str):
    """切換特定照片的啟用狀態 (決定違規時是否可能被發佈)。"""
    metadata = load_metadata()

    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="找不到指定的照片紀錄。")

    metadata[image_id]['selected'] = not metadata[image_id].get('selected', False)
    save_metadata(metadata)

    return {
        "success": True,
        "data": {
            "image_id": image_id,
            "selected": metadata[image_id]['selected']
        }
    }


@router.delete("/delete/{image_id}")
async def delete_image(image_id: str):
    """從伺服器端永久刪除指定的人質照片。"""
    metadata = load_metadata()

    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="找不到指定的照片紀錄。")

    # 執行實體檔案刪除
    image_path = HOSTAGE_DIR / metadata[image_id]['filename']
    if image_path.exists():
        try:
            os.remove(image_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"無法刪除實體檔案：{str(e)}")

    # 同步更新中繼資料
    del metadata[image_id]
    save_metadata(metadata)

    safe_print(f"[人質協定] 照片資料已清除：{image_id}")

    return {"success": True, "message": "照片已從系統中移除。"}


@router.get("/image/{image_id}")
async def get_image(image_id: str):
    """回傳原始圖片檔案（供前端預覽使用）。"""
    from fastapi.responses import FileResponse

    metadata = load_metadata()

    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="找不到指定的照片。")

    image_path = HOSTAGE_DIR / metadata[image_id]['filename']

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="實體檔案已遺失。")

    return FileResponse(image_path)


@router.get("/selected")
async def get_selected():
    """內部介面：獲取所有目前生效中的處罰素材列表。"""
    selected = get_selected_images()

    return {
        "success": True,
        "data": {
            "count": len(selected),
            "images": selected
        }
    }
