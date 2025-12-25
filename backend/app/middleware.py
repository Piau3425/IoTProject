"""
日誌中間件模組
=========================
提供 API 請求與響應的詳細日誌記錄功能。
"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .logger import safe_print


class LoggingMiddleware(BaseHTTPMiddleware):
    """用於記錄 HTTP 請求與響應資訊的中間件。

    紀錄內容包含：
    - 請求方法 (Method)、路徑 (Path) 與客戶端 IP
    - 響應狀態碼 (Status Code)
    - 請求處理耗時（毫秒）

    排除清單：
    - 靜態檔案與健康檢查介面
    - Socket.IO 的輪詢請求（避免日誌刷頻過於頻繁）
    """

    # 完整路徑排除清單
    EXCLUDED_PATHS = {
        "/socket.io/",
        "/favicon.ico",
        "/",  # 健康檢查介面 - 若有需要可獨立紀錄
    }

    # 路徑前綴排除清單
    EXCLUDED_PREFIXES = (
        "/socket.io",
        "/_next",
        "/static",
    )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """攔截請求並紀錄相關資訊。"""
        path = request.url.path

        # 針對排除清單中的路徑跳過紀錄流程
        if path in self.EXCLUDED_PATHS or path.startswith(self.EXCLUDED_PREFIXES):
            return await call_next(request)

        # 開始計時
        start_time = time.time()

        # 取得發起請求的 IP
        client_ip = request.client.host if request.client else "unknown"

        # 執行請求處理
        try:
            response = await call_next(request)

            # 計算總耗時
            process_time = (time.time() - start_time) * 1000  # 毫秒

            # 格式化輸出日誌
            status_emoji = self._get_status_emoji(response.status_code)
            safe_print(
                f"[API] {status_emoji} {request.method} {path} "
                f"→ {response.status_code} ({process_time:.1f}ms) [{client_ip}]"
            )

            return response

        except Exception as e:
            # 若處理過程發生異常，紀錄錯誤日誌
            process_time = (time.time() - start_time) * 1000
            safe_print(
                f"[API] ❌ {request.method} {path} "
                f"→ 發生異常 ({process_time:.1f}ms) [{client_ip}]: {str(e)}"
            )
            raise

    def _get_status_emoji(self, status_code: int) -> str:
        """根據 HTTP 狀態碼回傳對應的表情符號。"""
        if status_code < 300:
            return "✅"
        elif status_code < 400:
            return "↪️"
        elif status_code < 500:
            return "⚠️"
        else:
            return "❌"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """為響應添加請求 ID 的中間件。

    便於偵錯以及在分散式系統中追蹤單次請求的完整流程。
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """在響應標頭中加入 X-Request-ID。"""
        import uuid

        # 產生縮短版 UUID 作為請求標識
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response
