"""
憑證儲存管理器
負責儲存和載入使用者輸入的社交平台憑證
"""
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel


class PlatformCredentials(BaseModel):
    """單一平台的憑證"""
    gmail_user: Optional[str] = None
    gmail_app_password: Optional[str] = None
    threads_user_id: Optional[str] = None
    threads_access_token: Optional[str] = None
    discord_webhook_url: Optional[str] = None


class CredentialStore:
    """憑證儲存管理器"""
    
    def __init__(self, storage_path: str = "credentials.json"):
        self.storage_path = Path(storage_path)
        self.credentials: PlatformCredentials = self._load()
    
    def _load(self) -> PlatformCredentials:
        """從檔案載入憑證"""
        if not self.storage_path.exists():
            return PlatformCredentials()
        
        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return PlatformCredentials(**data)
        except Exception as e:
            print(f"[CredentialStore] 載入憑證失敗: {e}")
            return PlatformCredentials()
    
    def save(self):
        """儲存憑證到檔案"""
        try:
            # 確保目錄存在
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(
                    self.credentials.model_dump(exclude_none=False), 
                    f, 
                    indent=2, 
                    ensure_ascii=False
                )
            print(f"[CredentialStore] 憑證已儲存到 {self.storage_path}")
        except Exception as e:
            print(f"[CredentialStore] 儲存憑證失敗: {e}")
            raise
    
    def update_gmail(self, user: str, app_password: str):
        """更新 Gmail 憑證"""
        self.credentials.gmail_user = user
        self.credentials.gmail_app_password = app_password
        self.save()
    
    def update_threads(self, user_id: str, access_token: str):
        """更新 Threads 憑證"""
        self.credentials.threads_user_id = user_id
        self.credentials.threads_access_token = access_token
        self.save()
    
    def update_discord(self, webhook_url: str):
        """更新 Discord 憑證"""
        self.credentials.discord_webhook_url = webhook_url
        self.save()
    
    def clear_gmail(self):
        """清除 Gmail 憑證"""
        self.credentials.gmail_user = None
        self.credentials.gmail_app_password = None
        self.save()
    
    def clear_threads(self):
        """清除 Threads 憑證"""
        self.credentials.threads_user_id = None
        self.credentials.threads_access_token = None
        self.save()
    
    def clear_discord(self):
        """清除 Discord 憑證"""
        self.credentials.discord_webhook_url = None
        self.save()
    
    def get_gmail_credentials(self) -> tuple[Optional[str], Optional[str]]:
        """取得 Gmail 憑證"""
        return self.credentials.gmail_user, self.credentials.gmail_app_password
    
    def get_threads_credentials(self) -> tuple[Optional[str], Optional[str]]:
        """取得 Threads 憑證"""
        return self.credentials.threads_user_id, self.credentials.threads_access_token
    
    def get_discord_credentials(self) -> Optional[str]:
        """取得 Discord 憑證"""
        return self.credentials.discord_webhook_url


# 全域憑證儲存實例
credential_store = CredentialStore()
