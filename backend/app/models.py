from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime


class PhoneStatus(str, Enum):
    LOCKED = "LOCKED"
    REMOVED = "REMOVED"
    UNKNOWN = "UNKNOWN"


class PresenceStatus(str, Enum):
    DETECTED = "DETECTED"
    AWAY = "AWAY"
    UNKNOWN = "UNKNOWN"


class BoxStatus(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    UNKNOWN = "UNKNOWN"


class NoiseStatus(str, Enum):
    QUIET = "QUIET"
    NOISY = "NOISY"
    UNKNOWN = "UNKNOWN"


class SessionStatus(str, Enum):
    IDLE = "IDLE"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    VIOLATED = "VIOLATED"
    COMPLETED = "COMPLETED"


# ============================================================================
# v1.0 新增: 硬體狀態機狀態 (與韌體同步)
# ============================================================================
class HardwareState(str, Enum):
    """Hardware state machine states - synced with firmware."""
    IDLE = "IDLE"               # 待機狀態 - 等待開始指令
    PREPARING = "PREPARING"     # 準備中 - 10 秒寬限期
    FOCUSING = "FOCUSING"       # 專注中 - 監測違規行為
    PAUSED = "PAUSED"           # 暫停中 - 暫時停止監測
    VIOLATION = "VIOLATION"     # 違規狀態 - 偵測到違規行為
    ERROR = "ERROR"             # 錯誤狀態 - 系統異常


# ============================================================================
# 感測器資料模型
# ============================================================================
class SensorData(BaseModel):
    """Sensor data from hardware - v1.0 format."""
    # 硬體狀態機狀態 (v1.0 新增)
    state: Optional[str] = None  # HardwareState enum value
    
    # 霍爾感測器 (v1.0 新增, 取代 LDR)
    box_open: bool = False      # Hall sensor - True = box is open (violation)
    
    # 雷達感測器
    radar_presence: bool = False
    
    # 時間戳記
    timestamp: Optional[int] = None
    uptime: Optional[int] = None  # 硬體運行時間 (秒)
    
    # Legacy 相容性欄位 (保留給舊版韌體)
    nfc_id: Optional[str] = None
    gyro_x: float = 0.0
    gyro_y: float = 0.0
    gyro_z: float = 0.0
    mic_db: int = 40
    box_locked: bool = False
    nfc_detected: bool = False
    gyro_detected: bool = False
    ldr_detected: bool = False
    radar_detected: bool = False


class PenaltyConfig(BaseModel):
    """Granular penalty configuration - which sensors trigger violations."""
    enable_phone_penalty: bool = True     # NFC - phone removal triggers penalty
    enable_presence_penalty: bool = True  # Radar - leaving seat triggers penalty
    enable_noise_penalty: bool = False    # Mic - noise triggers penalty (default off for cafes)
    enable_box_open_penalty: bool = True  # Hall - opening box triggers penalty
    noise_threshold_db: int = 70          # dB threshold for noise violation


class FocusSession(BaseModel):
    id: str
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: SessionStatus = SessionStatus.IDLE
    violations: int = 0
    penalties_executed: int = 0
    penalty_config: PenaltyConfig = PenaltyConfig()


class SocialPlatform(str, Enum):
    DISCORD = "discord"
    THREADS = "threads"
    GMAIL = "gmail"


class PenaltySettings(BaseModel):
    enabled_platforms: List[SocialPlatform] = []
    custom_messages: dict = {
        "discord": "🚨 警報：我是一個沒有毅力的廢物，剛才的專注挑戰失敗了。請盡情嘲笑我。 🚨",
        "threads": "📢 系統公告：使用者自律協定違規，專注任務執行失敗。這是恥辱的印記。",
        "gmail": "📧 專注執法者通報：我無法完成專注任務，這是我的恥辱。"
    }
    gmail_recipients: List[str] = []
    include_timestamp: bool = True
    include_violation_count: bool = True


# ============================================================================
# 系統狀態模型 (v1.0 更新)
# ============================================================================
class SystemState(BaseModel):
    session: Optional[FocusSession] = None
    phone_status: PhoneStatus = PhoneStatus.UNKNOWN
    presence_status: PresenceStatus = PresenceStatus.UNKNOWN
    box_status: BoxStatus = BoxStatus.UNKNOWN
    noise_status: NoiseStatus = NoiseStatus.UNKNOWN
    current_db: int = 40
    last_sensor_data: Optional[SensorData] = None
    
    # v1.0 新增: 硬體狀態機
    hardware_state: HardwareState = HardwareState.IDLE
    
    # v1.0 新增: 準備倒數
    prepare_remaining_ms: int = 0  # 準備寬限期剩餘時間 (毫秒)
    
    # Legacy 相容性
    person_away_since: Optional[datetime] = None
    penalty_settings: PenaltySettings = PenaltySettings()
    penalty_config: PenaltyConfig = PenaltyConfig()  # Global default penalty config


class WebSocketMessage(BaseModel):
    type: str
    payload: dict
