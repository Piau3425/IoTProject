"""
憑證儲存管理器
====================
負責持久化儲存社交平台（Gmail、Discord、Threads）的 API 憑證與機敏資訊。
"""
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel


class PlatformCredentials(BaseModel):
    """各社交平台憑證的數據模型。"""
    gmail_user: Optional[str] = None
    gmail_app_password: Optional[str] = None
    threads_user_id: Optional[str] = None
    threads_access_token: Optional[str] = None
    discord_webhook_url: Optional[str] = None


class CredentialStore:
    """憑證儲存管理類別，提供檔案讀寫與更新介面。"""

    def __init__(self, storage_path: str = "credentials.json"):
        """初始化儲存路徑並自動載入現有資料。"""
        self.storage_path = Path(storage_path)
        self.credentials: PlatformCredentials = self._load()

    def _load(self) -> PlatformCredentials:
        """從 JSON 檔案中載入憑證資訊。"""
        if not self.storage_path.exists():
            return PlatformCredentials()

        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return PlatformCredentials(**data)
        except Exception as e:
            print(f"[憑證儲存] 載入失敗：{e}")
            return PlatformCredentials()

    def save(self):
        """將目前記憶體中的憑證寫入檔案系統。"""
        try:
            # 確保父層目錄已建立
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)

            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(
                    self.credentials.model_dump(exclude_none=False),
                    f,
                    indent=2,
                    ensure_ascii=False
                )
            print(f"[憑證儲存] 設定已更新至 {self.storage_path}")
        except Exception as e:
            print(f"[憑證儲存] 儲存失敗：{e}")
            raise

    def update_gmail(self, user: str, app_password: str):
        """更新 Gmail 系列帳號與應用程式密碼。"""
        self.credentials.gmail_user = user
        self.credentials.gmail_app_password = app_password
        self.save()

    def update_threads(self, user_id: str, access_token: str):
        """更新 Threads API 版權資訊。"""
        self.credentials.threads_user_id = user_id
        self.credentials.threads_access_token = access_token
        self.save()

    def update_discord(self, webhook_url: str):
        """更新 Discord Webhook URL。"""
        self.credentials.discord_webhook_url = webhook_url
        self.save()

    def clear_gmail(self):
        """重置 Gmail 相關資訊。"""
        self.credentials.gmail_user = None
        self.credentials.gmail_app_password = None
        self.save()

    def clear_threads(self):
        """重置 Threads 相關資訊。"""
        self.credentials.threads_user_id = None
        self.credentials.threads_access_token = None
        self.save()

    def clear_discord(self):
        """重置 Discord 相關資訊。"""
        self.credentials.discord_webhook_url = None
        self.save()

    def get_gmail_credentials(self) -> tuple[Optional[str], Optional[str]]:
        """取得 Gmail 登入憑證。"""
        return self.credentials.gmail_user, self.credentials.gmail_app_password

    def get_threads_credentials(self) -> tuple[Optional[str], Optional[str]]:
        """取得 Threads 存取權杖。"""
        return self.credentials.threads_user_id, self.credentials.threads_access_token

    def get_discord_credentials(self) -> Optional[str]:
        """取得 Discord Webhook 單一網址。"""
        return self.credentials.discord_webhook_url


# 建立全域單例物件供整體後端調用
credential_store = CredentialStore()
