from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List
import os
import shutil
import json
import uuid
from pathlib import Path

from ..logger import safe_print

router = APIRouter(prefix="/api/hostage", tags=["hostage"])

HOSTAGE_DIR = Path(__file__).parent.parent.parent / "hostage_evidence"
HOSTAGE_DIR.mkdir(parents=True, exist_ok=True)

METADATA_FILE = HOSTAGE_DIR / "metadata.json"
MAX_IMAGES = 30


class HostageImage(BaseModel):
    id: str
    filename: str
    selected: bool
    url: str


class HostageListResponse(BaseModel):
    images: List[HostageImage]
    total: int
    selected_count: int


def load_metadata() -> dict:
    """載入圖片中繼資料"""
    if METADATA_FILE.exists():
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_metadata(metadata: dict):
    """儲存圖片中繼資料"""
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def get_selected_images() -> List[str]:
    """取得已選取的圖片路徑列表"""
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
    """列出所有已上傳的圖片"""
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
    
    return HostageListResponse(
        images=images,
        total=len(images),
        selected_count=selected_count
    )


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """上傳新的人質照片"""
    # 檢查檔案類型
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="只能上傳圖片檔案")
    
    # 檢查數量限制
    metadata = load_metadata()
    if len(metadata) >= MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"最多只能上傳 {MAX_IMAGES} 張照片")
    
    # 生成唯一 ID 和檔名
    image_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    filename = f"{image_id}{file_ext}"
    file_path = HOSTAGE_DIR / filename
    
    # 儲存檔案
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"儲存檔案失敗: {str(e)}")
    
    # 更新中繼資料（新上傳的預設為選取）
    metadata[image_id] = {
        'filename': filename,
        'original_name': file.filename,
        'selected': True
    }
    save_metadata(metadata)
    
    safe_print(f"[人質協定] 新照片已上傳: {filename} (ID: {image_id})")
    
    return {
        "success": True,
        "image_id": image_id,
        "filename": filename,
        "message": "上傳成功"
    }


@router.post("/toggle/{image_id}")
async def toggle_selection(image_id: str):
    """切換圖片的選取狀態"""
    metadata = load_metadata()
    
    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="圖片不存在")
    
    # 切換選取狀態
    metadata[image_id]['selected'] = not metadata[image_id].get('selected', False)
    save_metadata(metadata)
    
    return {
        "success": True,
        "image_id": image_id,
        "selected": metadata[image_id]['selected']
    }


@router.delete("/delete/{image_id}")
async def delete_image(image_id: str):
    """刪除指定的圖片"""
    metadata = load_metadata()
    
    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="圖片不存在")
    
    # 刪除檔案
    image_path = HOSTAGE_DIR / metadata[image_id]['filename']
    if image_path.exists():
        try:
            os.remove(image_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"刪除檔案失敗: {str(e)}")
    
    # 從中繼資料移除
    del metadata[image_id]
    save_metadata(metadata)
    
    safe_print(f"[人質協定] 照片已刪除: {image_id}")
    
    return {
        "success": True,
        "message": "刪除成功"
    }


@router.get("/image/{image_id}")
async def get_image(image_id: str):
    """取得圖片檔案"""
    from fastapi.responses import FileResponse
    
    metadata = load_metadata()
    
    if image_id not in metadata:
        raise HTTPException(status_code=404, detail="圖片不存在")
    
    image_path = HOSTAGE_DIR / metadata[image_id]['filename']
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="圖片檔案不存在")
    
    return FileResponse(image_path)


@router.get("/selected")
async def get_selected():
    """取得所有已選取的圖片列表（用於處罰執行）"""
    selected = get_selected_images()
    
    return {
        "count": len(selected),
        "images": selected
    }
