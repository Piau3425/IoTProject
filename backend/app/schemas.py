"""
API 響應模型模組
============================
提供標準化的 API 響應結構定義。
確保所有後端介面回傳的 JSON 格式一致且易於前端解析。
"""

from pydantic import BaseModel
from typing import Optional, List, Any, Dict, TypeVar, Generic


T = TypeVar('T')


class APIResponse(BaseModel, Generic[T]):
    """標準 API 響應包裝結構。

    所有成功的 API 請求皆應採用以下格式：
    {
        "success": true,
        "data": { ... },
        "message": "選填的成功訊息"
    }

    類型參數：
        T: 核心數據 (payload) 的具體模型類型
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """標準錯誤響應格式。

    當 API 執行失敗或參數錯誤時，應回傳此格式：
    {
        "error": true,
        "error_code": "機器可讀的錯誤代碼",
        "message": "人類可讀的錯誤描述",
        "details": { ... }
    }
    """
    error: bool = True
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """分頁清單響應格式。

    適用於回傳多筆數據且支援分頁的介面：
    {
        "success": true,
        "data": [...],
        "total": 總筆數,
        "page": 當前頁碼,
        "page_size": 每頁筆數,
        "has_more": 是否還有下一頁
    }
    """
    success: bool = True
    data: List[T]
    total: int
    page: int = 1
    page_size: int = 20
    has_more: bool = False


# =============================================================================
# 常用商業邏輯響應模型
# =============================================================================

class SessionInfo(BaseModel):
    """用於 API 回傳的專注任務簡要資訊。"""
    id: str
    duration_minutes: int
    status: str
    violations: int
    penalties_executed: int
    start_time: Optional[str] = None
    paused_at: Optional[str] = None
    total_paused_seconds: int = 0


class HardwareInfo(BaseModel):
    """硬體連線與狀態摘要。"""
    connected: bool
    mock_mode: bool
    hardware_state: str
    nfc_detected: bool = False
    ir_detected: bool = False
    radar_detected: bool = False
    lcd_detected: bool = False
    firmware_version: Optional[str] = None


class SystemStatus(BaseModel):
    """API 特供：系統全域狀態完整摘要。"""
    session: Optional[SessionInfo] = None
    hardware: HardwareInfo
    phone_status: str
    presence_status: str
    box_status: str
    noise_status: str
    current_db: int


# =============================================================================
# 回應生成輔助函式 (Helper Functions)
# =============================================================================

def success_response(data: Any = None, message: str = None) -> Dict[str, Any]:
    """生成標準的成功響應字典。

    Args:
        data: 回傳的數據物件
        message: 選填的成功文字說明
    """
    response = {"success": True}
    if data is not None:
        response["data"] = data
    if message:
        response["message"] = message
    return response


def error_response(
    error_code: str,
    message: str,
    details: Dict[str, Any] = None
) -> Dict[str, Any]:
    """生成標準的錯誤響應字典。

    Args:
        error_code: 機器可識別的錯誤代碼 (例如: AUTH_FAILED)
        message: 提供給使用者看的錯誤描述文字
        details: 額外的錯誤細節資訊
    """
    response = {
        "error": True,
        "error_code": error_code,
        "message": message
    }
    if details:
        response["details"] = details
    return response


def paginated_response(
    items: List[Any],
    total: int,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """生成標準的分頁清單響應字典。

    Args:
        items: 當前頁面的數據列表
        total: 總數據筆數
        page: 當前所在的頁碼
        page_size: 單頁顯示筆數
    """
    return {
        "success": True,
        "data": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total
    }
