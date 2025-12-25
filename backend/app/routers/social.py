"""社交平台整合路由，用於設定與執行違規罰則。"""
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models import SocialPlatform, PenaltySettings
from ..socket_manager import socket_manager
from ..automation.social_manager import social_manager
from ..credential_store import credential_store
from ..config import settings
from ..schemas import success_response

router = APIRouter(prefix="/api/social", tags=["social"])


class PenaltySettingsRequest(BaseModel):
    """更新處罰設定的請求模型。"""
    enabled_platforms: List[str]
    custom_messages: dict
    gmail_recipients: List[str] = []
    include_timestamp: bool = True
    include_violation_count: bool = True


class TestPostRequest(BaseModel):
    """測試發文功能的請求模型。"""
    platform: str
    message: str


class GmailCredentialsRequest(BaseModel):
    """Gmail 憑證請求模型。"""
    email: str
    app_password: str


class ThreadsCredentialsRequest(BaseModel):
    """Threads API 憑證請求模型 (進階)。"""
    user_id: str
    access_token: str


class ThreadsBrowserLoginRequest(BaseModel):
    """Threads 瀏覽器登入請求模型（簡化版）。"""
    username: str
    password: str


class DiscordCredentialsRequest(BaseModel):
    """Discord Webhook 憑證請求模型。"""
    webhook_url: str


@router.get("/settings")
async def get_penalty_settings():
    """查詢當前處罰機制的所有設定。"""
    settings_data = socket_manager.state.penalty_settings.model_dump()
    return success_response(settings_data)


@router.post("/settings")
async def update_penalty_settings(request: PenaltySettingsRequest):
    """批次更新處罰機制設定。"""
    try:
        # 將請求轉換為對應的模型實例
        new_settings = PenaltySettings(
            enabled_platforms=[SocialPlatform(p) for p in request.enabled_platforms],
            custom_messages=request.custom_messages,
            gmail_recipients=request.gmail_recipients or [],
            include_timestamp=request.include_timestamp,
            include_violation_count=request.include_violation_count
        )

        socket_manager.state.penalty_settings = new_settings
        await socket_manager.broadcast_state(force=True)
        return success_response(new_settings.model_dump(), message="設定已成功更新")
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"不支援的平台類型：{str(e)}"
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/login-status")
async def get_login_status():
    """獲取目前所有社群平台的連通或登入狀態。"""
    status = social_manager.get_login_status()
    return success_response(status)


@router.get("/login-status/{platform}")
async def get_platform_login_status(platform: str):
    """查詢特定平台的登入（配置）狀態。"""
    try:
        plat = SocialPlatform(platform)
        if plat == SocialPlatform.DISCORD:
            return success_response({
                "platform": platform,
                "logged_in": bool(settings.DISCORD_WEBHOOK_URL)
            })
        is_logged_in = social_manager.is_platform_logged_in(plat)
        return success_response({
            "platform": platform,
            "logged_in": is_logged_in
        })
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"未知平台：{platform}") from exc


@router.post("/login/{platform}")
async def open_login(platform: str):
    """引導進行手動登入程序。"""
    try:
        plat = SocialPlatform(platform)
        if plat == SocialPlatform.DISCORD:
            return success_response(
                message=f"{platform} 採 Webhook URL 配置。請直接在下方輸入網址。"
            )
        return success_response(
            message=f"{platform} 目前僅支援直接憑證設定。請於 .env 檔案中進行配置。",
            data={"configured": False}
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"未知平台：{platform}") from exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"無法啟動登入流程：{str(e)}") from e


@router.post("/save-session/{platform}")
async def save_platform_session(platform: str):
    """保存瀏覽器自動化作業中的 Session (用於持久化登入)。"""
    try:
        plat = SocialPlatform(platform)
        if social_manager.is_platform_logged_in(plat):
            return success_response(
                message=f"{platform} 整合已生效",
                data={"logged_in": True}
            )
        return success_response(
            message=f"{platform} 尚未在 .env 中配置憑證",
            data={"logged_in": False, "configured": False}
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"未知平台：{platform}"
        ) from exc


@router.post("/logout/{platform}")
async def logout_platform(platform: str):
    """登出特定平台並清除所有儲存的憑證檔案。"""
    try:
        plat = SocialPlatform(platform)

        # 根據平台類型進行資源清理
        if plat == SocialPlatform.GMAIL:
            credential_store.clear_gmail()
            settings.GMAIL_USER = None
            settings.GMAIL_APP_PASSWORD = None
        elif plat == SocialPlatform.THREADS:
            credential_store.clear_threads()
            settings.THREADS_USER_ID = None
            settings.THREADS_ACCESS_TOKEN = None
        elif plat == SocialPlatform.DISCORD:
            credential_store.clear_discord()
            settings.DISCORD_WEBHOOK_URL = None

        return success_response(
            message=f"已成功移除 {platform} 的所有設定資訊",
            data={"logged_in": False}
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"未知平台：{platform}") from exc


@router.post("/test-post")
async def test_post(request: TestPostRequest):
    """執行測試性質的公開發文。"""
    try:
        platform = SocialPlatform(request.platform)
        success = False

        # 若存在人質照片，Threads 發文時會優先使用
        from .sessions import get_hostage_image_if_exists
        hostage_path = get_hostage_image_if_exists()

        if platform == SocialPlatform.DISCORD:
            success = await social_manager.post_to_discord(request.message, hostage_path)
        elif platform == SocialPlatform.THREADS:
            success = await social_manager.post_to_threads(request.message, hostage_path)
        elif platform == SocialPlatform.GMAIL:
            # 從目前的處罰設定中動態獲取收件者清單
            recipients = socket_manager.state.penalty_settings.gmail_recipients
            success = await social_manager.send_shame_email(request.message, recipients)

        if success:
            return success_response(
                message=f"已成功發佈訊息至 {request.platform}",
                data={"platform": request.platform, "hostage_used": hostage_path}
            )
        raise HTTPException(status_code=500, detail=f"無法在 {request.platform} 正常發佈訊息")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========== 憑證管理 API (主要供管理介面使用) ==========

@router.post("/credentials/gmail")
async def set_gmail_credentials(request: GmailCredentialsRequest):
    """設定 Gmail 發信專用憑證。"""
    try:
        # 驗證 Gmail 帳號格式
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@(gmail\.com)$'
        if not re.match(email_pattern, request.email.lower()):
            raise HTTPException(
                status_code=400,
                detail="請輸入有效的 Gmail 地址（需以 @gmail.com 結尾）"
            )
        
        # 驗證應用程式密碼格式（應為 16 位無空格字元）
        app_password_clean = request.app_password.replace(" ", "").strip()
        if len(app_password_clean) != 16 or not app_password_clean.isalpha():
            raise HTTPException(
                status_code=400,
                detail="應用程式密碼格式錯誤：應為 16 位英文字母（不含空格）"
            )
        
        # 持久化儲存
        credential_store.update_gmail(request.email, app_password_clean)

        # 同步更新執行期環境變數
        settings.GMAIL_USER = request.email
        settings.GMAIL_APP_PASSWORD = app_password_clean

        return success_response(message="Gmail 發信資訊已就位", data={"logged_in": True})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail 憑證更新失敗：{str(e)}") from e


@router.post("/credentials/threads")
async def set_threads_credentials(request: ThreadsCredentialsRequest):
    """設定 Threads API 密鑰資訊。"""
    try:
        # 驗證 User ID 格式（應為純數字）
        if not request.user_id.strip().isdigit():
            raise HTTPException(
                status_code=400,
                detail="Threads User ID 格式錯誤：應為純數字"
            )
        
        # 驗證 Access Token 格式（基本長度檢查）
        access_token_clean = request.access_token.strip()
        if len(access_token_clean) < 20:
            raise HTTPException(
                status_code=400,
                detail="Threads Access Token 格式錯誤：密鑰長度不足"
            )
        
        credential_store.update_threads(request.user_id.strip(), access_token_clean)

        settings.THREADS_USER_ID = request.user_id.strip()
        settings.THREADS_ACCESS_TOKEN = access_token_clean

        return success_response(message="Threads API 密鑰已儲存", data={"logged_in": True})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Threads 憑證儲存失敗：{str(e)}") from e


@router.post("/credentials/threads/browser")
async def login_threads_browser(request: ThreadsBrowserLoginRequest):
    """透過自動化瀏覽器直接登入 Threads 帳號。"""
    try:
        # 驗證帳號和密碼不為空
        if not request.username.strip() or not request.password.strip():
            raise HTTPException(
                status_code=400,
                detail="帳號和密碼不可為空"
            )
        
        success = await social_manager.login_threads_browser(
            request.username.strip(),
            request.password.strip()
        )

        if success:
            # 登入成功後即刻廣播狀態變更
            await socket_manager.broadcast_state(force=True)
            return success_response(message="Threads 登入成功！", data={"logged_in": True})
        raise HTTPException(
            status_code=400,
            detail="Threads 登入失敗，請確認帳號或密碼是否輸入有誤。"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"自動化登入程序發生異常：{str(e)}") from e


@router.post("/credentials/discord")
async def set_discord_credentials(request: DiscordCredentialsRequest):
    """設定 Discord 處罰通知專用的 Webhook 網址。"""
    try:
        # 驗證 Discord Webhook URL 格式
        import re
        webhook_pattern = r'^https://discord\.com/api/webhooks/\d+/[A-Za-z0-9_-]+$'
        webhook_url_clean = request.webhook_url.strip()
        
        if not re.match(webhook_pattern, webhook_url_clean):
            raise HTTPException(
                status_code=400,
                detail="Discord Webhook URL 格式錯誤：應為 https://discord.com/api/webhooks/... 格式"
            )
        
        credential_store.update_discord(webhook_url_clean)
        settings.DISCORD_WEBHOOK_URL = webhook_url_clean

        return success_response(message="Discord 轉發位址已更新", data={"logged_in": True})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discord webhook 更新失敗：{str(e)}") from e


@router.get("/credentials/{platform}")
async def get_credentials_status(platform: str):
    """查詢各平台的設定概況（遮蔽敏感內文）。"""
    try:
        plat = SocialPlatform(platform)
        is_configured = social_manager.is_platform_logged_in(plat)

        # 僅返回安全性摘要摘要，避免外洩實際 Token
        info = {"configured": is_configured}

        if plat == SocialPlatform.GMAIL and is_configured:
            info["email"] = settings.GMAIL_USER
        elif plat == SocialPlatform.THREADS and is_configured:
            info["user_id"] = settings.THREADS_USER_ID
        elif plat == SocialPlatform.DISCORD and is_configured:
            info["webhook_configured"] = True

        return info
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"未知平台：{platform}") from exc
