"""
設定管理模組
====================
應用程式全域設定中心，支援環境變數載入與憑證加密儲存。
"""
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """應用程式設定類別，具備環境變數連動功能。

    設定優先級：
    1. 憑證管理員 (Credential Store) 內部儲存值
    2. .env 檔案內容
    3. 類別定義中的預設值
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        extra="ignore"
    )

    APP_NAME: str = "The Focus Enforcer v1.0"
    DEBUG: bool = False

    # 伺服器啟動設定
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # 模擬硬體模式 - 若為 False 則優先嘗試連線實體 ESP32
    MOCK_HARDWARE: bool = False
    MOCK_INTERVAL_MS: int = 500

    # Gmail SMTP 發送設定（直接整合）
    GMAIL_USER: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None

    # Threads API 存取設定（直接整合）
    THREADS_USER_ID: Optional[str] = None
    THREADS_ACCESS_TOKEN: Optional[str] = None

    # Discord Webhook 設定
    DISCORD_WEBHOOK_URL: Optional[str] = None

    # 預設違規判定閾值
    PERSON_AWAY_THRESHOLD_SEC: int = 10
    MOTION_THRESHOLD: float = 0.5

    def load_from_credential_store(self):
        """從加密憑證儲存空間載入機敏資訊（優先權高於 .env）。"""
        try:
            from .credential_store import credential_store

            # 載入 Gmail 憑證
            gmail_user, gmail_pass = credential_store.get_gmail_credentials()
            if gmail_user:
                self.GMAIL_USER = gmail_user
            if gmail_pass:
                self.GMAIL_APP_PASSWORD = gmail_pass

            # 載入 Threads 憑證
            threads_id, threads_token = credential_store.get_threads_credentials()
            if threads_id:
                self.THREADS_USER_ID = threads_id
            if threads_token:
                self.THREADS_ACCESS_TOKEN = threads_token

            # 載入 Discord Webhook
            discord_webhook = credential_store.get_discord_credentials()
            if discord_webhook:
                self.DISCORD_WEBHOOK_URL = discord_webhook
        except Exception as e:
            print(f"[設定] 警告：無法從專屬儲存空間載入憑證：{e}")
            print("[設定] 將僅使用 .env 檔案內的配置")


# 實例化全域設定物件
settings = Settings()

# 檢查 .env 是否存在，若無則提醒使用者
env_path = Path(__file__).parent.parent / ".env"
if not env_path.exists():
    print("[設定] 提示：找不到 .env 檔案，將使用預設數值運行。")
    print("[設定] 建議將 .env.example 複製為 .env 並完成對應配置。")

# 強制執行一次憑證載入
settings.load_from_credential_store()
