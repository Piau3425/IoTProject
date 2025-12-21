from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from ..models import SocialPlatform, PenaltySettings
from ..socket_manager import socket_manager
from ..automation.social_manager import social_manager
from ..credential_store import credential_store
from ..config import settings

router = APIRouter(prefix="/api/social", tags=["social"])


class PenaltySettingsRequest(BaseModel):
    enabled_platforms: List[str]
    custom_messages: dict
    gmail_recipients: List[str] = []
    include_timestamp: bool = True
    include_violation_count: bool = True


class TestPostRequest(BaseModel):
    platform: str
    message: str


class GmailCredentialsRequest(BaseModel):
    email: str
    app_password: str


class ThreadsCredentialsRequest(BaseModel):
    user_id: str
    access_token: str


class ThreadsBrowserLoginRequest(BaseModel):
    """Threads 瀏覽器登入請求（簡化版）"""
    username: str
    password: str


class DiscordCredentialsRequest(BaseModel):
    webhook_url: str


@router.get("/settings")
async def get_penalty_settings():
    """Get current penalty settings."""
    return socket_manager.state.penalty_settings.model_dump()


@router.post("/settings")
async def update_penalty_settings(request: PenaltySettingsRequest):
    """Update penalty settings."""
    try:
        platforms = [SocialPlatform(p) for p in request.enabled_platforms]
        socket_manager.state.penalty_settings = PenaltySettings(
            enabled_platforms=platforms,
            custom_messages=request.custom_messages,
            gmail_recipients=request.gmail_recipients,
            include_timestamp=request.include_timestamp,
            include_violation_count=request.include_violation_count
        )
        await socket_manager.broadcast_state(force=True)
        return {"success": True, "message": "Settings updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/login-status")
async def get_login_status():
    """Get login status for all platforms."""
    return social_manager.get_login_status()


@router.get("/login-status/{platform}")
async def get_platform_login_status(platform: str):
    """Get login status for a specific platform."""
    try:
        plat = SocialPlatform(platform)
        if plat == SocialPlatform.DISCORD:
            return {"platform": platform, "logged_in": bool(settings.DISCORD_WEBHOOK_URL)}
        is_logged_in = social_manager.is_platform_logged_in(plat)
        return {"platform": platform, "logged_in": is_logged_in}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")


@router.post("/login/{platform}")
async def open_login(platform: str):
    """Open browser for manual login to a platform."""
    try:
        plat = SocialPlatform(platform)
        if plat == SocialPlatform.DISCORD:
            return {"success": True, "message": f"{platform} uses webhook URL configuration. Please enter credentials below"}
        return {"success": False, "message": f"{platform} uses direct integration. Please configure credentials in .env"}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open login page: {str(e)}")


@router.post("/save-session/{platform}")
async def save_platform_session(platform: str):
    """Save browser session after manual login."""
    try:
        plat = SocialPlatform(platform)
        if social_manager.is_platform_logged_in(plat):
             return {"success": True, "message": f"Integration active for {platform}", "logged_in": True}
        else:
             return {"success": False, "message": f"{platform} credentials not configured in .env"}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")


@router.post("/logout/{platform}")
async def logout_platform(platform: str):
    """Logout from a platform (delete saved credentials)."""
    try:
        plat = SocialPlatform(platform)
        
        # Clear credentials based on platform
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
        
        return {"success": True, "message": f"Successfully logged out from {platform}", "logged_in": False}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")


@router.post("/test-post")
async def test_post(request: TestPostRequest):
    """Test posting to a platform."""
    try:
        platform = SocialPlatform(request.platform)
        success = False
        
        # Get hostage image if exists (might be used for threads)
        from .sessions import get_hostage_image_if_exists
        hostage_path = get_hostage_image_if_exists()
        
        if platform == SocialPlatform.DISCORD:
            success = await social_manager.post_to_discord(request.message)
        elif platform == SocialPlatform.THREADS:
            success = await social_manager.post_to_threads(request.message, hostage_path)
        elif platform == SocialPlatform.GMAIL:
            # Get recipients from current penalty settings
            recipients = socket_manager.state.penalty_settings.gmail_recipients
            success = await social_manager.send_shame_email(request.message, recipients)
        
        return {"success": success, "platform": request.platform, "hostage_used": hostage_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ========== 憑證管理 API ==========

@router.post("/credentials/gmail")
async def set_gmail_credentials(request: GmailCredentialsRequest):
    """設定 Gmail 憑證"""
    try:
        # 儲存到憑證儲存
        credential_store.update_gmail(request.email, request.app_password)
        
        # 更新執行時設定
        settings.GMAIL_USER = request.email
        settings.GMAIL_APP_PASSWORD = request.app_password
        
        return {
            "success": True,
            "message": "Gmail 憑證已設定",
            "logged_in": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定 Gmail 憑證失敗: {str(e)}")


@router.post("/credentials/threads")
async def set_threads_credentials(request: ThreadsCredentialsRequest):
    """設定 Threads API 憑證（進階版）"""
    try:
        # 儲存到憑證儲存
        credential_store.update_threads(request.user_id, request.access_token)
        
        # 更新執行時設定
        settings.THREADS_USER_ID = request.user_id
        settings.THREADS_ACCESS_TOKEN = request.access_token
        
        return {
            "success": True,
            "message": "Threads API 憑證已設定",
            "logged_in": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定 Threads 憑證失敗: {str(e)}")


@router.post("/credentials/threads/browser")
async def login_threads_browser(request: ThreadsBrowserLoginRequest):
    """使用帳號密碼登入 Threads（簡化版）"""
    try:
        success = await social_manager.login_threads_browser(
            request.username,
            request.password
        )
        
        if success:
            # 廣播狀態更新
            await socket_manager.broadcast_state(force=True)
            
            return {
                "success": True,
                "message": "Threads 登入成功！",
                "logged_in": True
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="登入失敗，請檢查帳號密碼是否正確"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Threads 登入錯誤: {str(e)}")


@router.post("/credentials/discord")
async def set_discord_credentials(request: DiscordCredentialsRequest):
    """設定 Discord Webhook URL"""
    try:
        # 儲存到憑證儲存
        credential_store.update_discord(request.webhook_url)
        
        # 更新執行時設定
        settings.DISCORD_WEBHOOK_URL = request.webhook_url
        
        return {
            "success": True,
            "message": "Discord Webhook 已設定",
            "logged_in": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定 Discord Webhook 失敗: {str(e)}")


@router.get("/credentials/{platform}")
async def get_credentials_status(platform: str):
    """取得平台憑證狀態（不返回實際憑證）"""
    try:
        plat = SocialPlatform(platform)
        is_configured = social_manager.is_platform_logged_in(plat)
        
        # 返回部分資訊（不返回完整憑證）
        info = {"configured": is_configured}
        
        if plat == SocialPlatform.GMAIL and is_configured:
            info["email"] = settings.GMAIL_USER
        elif plat == SocialPlatform.THREADS and is_configured:
            info["user_id"] = settings.THREADS_USER_ID
        elif plat == SocialPlatform.DISCORD and is_configured:
            info["webhook_configured"] = True
        
        return info
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
