"""
自定義異常模組
========================
定義專案專用的異常類別，提供結構化的錯誤處理架構。
"""

from typing import Optional, Dict, Any


class FocusEnforcerError(Exception):
    """應用程式基礎異常類別。

    所有自定義異常都應繼承此類別，以便進行統一的錯誤捕獲與日誌記錄。

    屬性：
        message: 提供給人類閱讀的錯誤訊息
        error_code: 機器可讀的錯誤代碼，用於前端識別
        details: 額外的錯誤細節資訊
    """

    def __init__(
        self,
        message: str,
        error_code: str = "FOCUS_ENFORCER_ERROR",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """將異常對象轉換為字典格式，供 API 輸出。"""
        return {
            "error": True,
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details
        }


# =============================================================================
# 專注任務相關異常
# =============================================================================

class SessionError(FocusEnforcerError):
    """專注任務 (Session) 相關的業務異常。"""

    def __init__(
        self,
        message: str,
        error_code: str = "SESSION_ERROR",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        super().__init__(message, error_code, details)


class SessionNotFoundError(SessionError):
    """找不到該專注任務時觸發。"""

    def __init__(self, session_id: Optional[str] = None) -> None:
        details = {"session_id": session_id} if session_id else {}
        super().__init__(
            message="查無目前進行中的專注任務",
            error_code="SESSION_NOT_FOUND",
            details=details
        )


class SessionAlreadyActiveError(SessionError):
    """當前已有任務正在執行，嘗試重複啟動時觸發。"""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            message="目前已有正在進行中的專注任務",
            error_code="SESSION_ALREADY_ACTIVE",
            details={"active_session_id": session_id}
        )


class InvalidSessionStateError(SessionError):
    """專注任務狀態轉換非法時觸發（例如暫停已完成的任務）。"""

    def __init__(self, current_state: str, attempted_action: str) -> None:
        super().__init__(
            message=f"無法在狀態 {current_state} 下執行 {attempted_action} 操作",
            error_code="INVALID_SESSION_STATE",
            details={
                "current_state": current_state,
                "attempted_action": attempted_action
            }
        )


# =============================================================================
# 硬體相關異常
# =============================================================================

class HardwareError(FocusEnforcerError):
    """硬體連線或感測器故障相關異常。"""

    def __init__(
        self,
        message: str,
        error_code: str = "HARDWARE_ERROR",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        super().__init__(message, error_code, details)


class HardwareNotConnectedError(HardwareError):
    """硬體未連線異常。"""

    def __init__(self) -> None:
        super().__init__(
            message="目前未偵測到任何實體硬體裝置",
            error_code="HARDWARE_NOT_CONNECTED"
        )


class HardwareCommunicationError(HardwareError):
    """與硬體通訊過程中發生故障。"""

    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"硬體通訊失敗：{reason}",
            error_code="HARDWARE_COMMUNICATION_ERROR",
            details={"reason": reason}
        )


# =============================================================================
# 社群平台相關異常
# =============================================================================

class SocialPlatformError(FocusEnforcerError):
    """社群平台 (Discord, Threads 等) 整合異常。"""

    def __init__(
        self,
        message: str,
        platform: str,
        error_code: str = "SOCIAL_PLATFORM_ERROR",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        details = details or {}
        details["platform"] = platform
        super().__init__(message, error_code, details)


class SocialAuthenticationError(SocialPlatformError):
    """平台身分驗證失敗異常。"""

    def __init__(self, platform: str, reason: Optional[str] = None) -> None:
        message = f"無法登入 {platform} 平台"
        if reason:
            message += f"：{reason}"
        super().__init__(
            message=message,
            platform=platform,
            error_code="SOCIAL_AUTH_ERROR",
            details={"reason": reason} if reason else None
        )


class SocialPostingError(SocialPlatformError):
    """平台發文或訊息傳送失敗異常。"""

    def __init__(self, platform: str, reason: str) -> None:
        super().__init__(
            message=f"無法在 {platform} 平台發布內容：{reason}",
            platform=platform,
            error_code="SOCIAL_POSTING_ERROR",
            details={"reason": reason}
        )


# =============================================================================
# 「人質」照片相關異常
# =============================================================================

class HostageError(FocusEnforcerError):
    """人質照片管理異常。"""

    def __init__(
        self,
        message: str,
        error_code: str = "HOSTAGE_ERROR",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        super().__init__(message, error_code, details)


class HostageNotFoundError(HostageError):
    """找不到指定的人質照片檔案。"""

    def __init__(self, filename: str) -> None:
        super().__init__(
            message=f"找不到人質照片檔案：{filename}",
            error_code="HOSTAGE_NOT_FOUND",
            details={"filename": filename}
        )


class HostageUploadError(HostageError):
    """人質照片上傳失敗。"""

    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"照片上傳失敗：{reason}",
            error_code="HOSTAGE_UPLOAD_ERROR",
            details={"reason": reason}
        )


class InvalidHostageFormatError(HostageError):
    """人質照片格式不符。"""

    def __init__(self, filename: str, allowed_formats: list) -> None:
        super().__init__(
            message=f"檔案 {filename} 格式不正確。允許的格式：{', '.join(allowed_formats)}",
            error_code="INVALID_HOSTAGE_FORMAT",
            details={
                "filename": filename,
                "allowed_formats": allowed_formats
            }
        )


# =============================================================================
# 參數檢核異常
# =============================================================================

class ValidationError(FocusEnforcerError):
    """API 輸入參數驗證失敗異常。"""

    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None
    ) -> None:
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)

        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details=details
        )
