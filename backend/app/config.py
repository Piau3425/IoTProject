from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "The Focus Enforcer v1.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Mock Hardware Mode - Default to False, real hardware takes priority
    MOCK_HARDWARE: bool = False
    MOCK_INTERVAL_MS: int = 500
    
    # Gmail Configuration (Direct Integration)
    GMAIL_USER: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None
    
    # Threads API Configuration (Direct Integration)
    THREADS_USER_ID: Optional[str] = None
    THREADS_ACCESS_TOKEN: Optional[str] = None
    
    # Discord Configuration
    DISCORD_WEBHOOK_URL: Optional[str] = None
    
    # Penalty Thresholds
    PERSON_AWAY_THRESHOLD_SEC: int = 10
    MOTION_THRESHOLD: float = 0.5
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = "ignore"  # Ignore extra fields in .env file
    
    def load_from_credential_store(self):
        """從憑證儲存中載入設定（優先於 .env）"""
        try:
            from .credential_store import credential_store
            
            # Gmail
            gmail_user, gmail_pass = credential_store.get_gmail_credentials()
            if gmail_user:
                self.GMAIL_USER = gmail_user
            if gmail_pass:
                self.GMAIL_APP_PASSWORD = gmail_pass
            
            # Threads
            threads_id, threads_token = credential_store.get_threads_credentials()
            if threads_id:
                self.THREADS_USER_ID = threads_id
            if threads_token:
                self.THREADS_ACCESS_TOKEN = threads_token
            
            # Discord
            discord_webhook = credential_store.get_discord_credentials()
            if discord_webhook:
                self.DISCORD_WEBHOOK_URL = discord_webhook
        except Exception as e:
            print(f"[CONFIG] Warning: Could not load credentials from store: {e}")
            print("[CONFIG] Using configuration from .env file only")


# Initialize settings
settings = Settings()

# Check if .env exists, if not warn user
env_path = Path(__file__).parent.parent / ".env"
if not env_path.exists():
    print("[CONFIG] Warning: .env file not found. Using default settings.")
    print("[CONFIG] Copy .env.example to .env and configure your settings.")

# 載入使用者儲存的憑證（優先於 .env）
settings.load_from_credential_store()
