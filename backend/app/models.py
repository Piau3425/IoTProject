from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime


class PhoneStatus(str, Enum):
    """手機在位狀態列舉。"""
    LOCKED = "LOCKED"     # 手機已安置在盒子內且鎖定
    REMOVED = "REMOVED"   # 手機被移出盒子
    UNKNOWN = "UNKNOWN"   # 狀態未知


class PresenceStatus(str, Enum):
    """人員在位狀態列舉。"""
    DETECTED = "DETECTED" # 偵測到人員在位
    AWAY = "AWAY"         # 人員不在位
    UNKNOWN = "UNKNOWN"   # 狀態未知


class BoxStatus(str, Enum):
    """盒子開關狀態列舉。"""
    CLOSED = "CLOSED"     # 盒子已關閉
    OPEN = "OPEN"         # 盒子被打開
    UNKNOWN = "UNKNOWN"   # 狀態未知


class NoiseStatus(str, Enum):
    """環境噪音狀態列舉。"""
    QUIET = "QUIET"       # 環境安靜
    NOISY = "NOISY"       # 偵測到持續噪音
    UNKNOWN = "UNKNOWN"   # 狀態未知


class SessionStatus(str, Enum):
    """專注任務生命週期狀態。"""
    IDLE = "IDLE"           # 閒置中
    ACTIVE = "ACTIVE"       # 任務執行中
    PAUSED = "PAUSED"       # 任務暫停
    VIOLATED = "VIOLATED"   # 偵測到違規，正處於懲罰流程
    COMPLETED = "COMPLETED" # 任務圓滿完成


# ============================================================================
# 硬體狀態機狀態 (與 ESP32 韌體端狀態同步)
# ============================================================================
class HardwareState(str, Enum):
    """硬體內部狀態機狀態定義。"""
    IDLE = "IDLE"               # 待機狀態 - 等待啟動指令
    PREPARING = "PREPARING"     # 準備中 - 設定 10 秒倒數寬限期
    FOCUSING = "FOCUSING"       # 專注中 - 執行即時監測與違規判斷
    PAUSED = "PAUSED"           # 暫停中 - 暫時停止硬體端監測
    VIOLATION = "VIOLATION"     # 違規狀態 - 硬體偵測到即時違規行為
    ERROR = "ERROR"             # 錯誤狀態 - 系統內部異常


# ============================================================================
# 感測器資料模型：定義從硬體回報的原始數據格式
# ============================================================================
class SensorData(BaseModel):
    """硬體感測器回報數據模型 (v1.0 格式)。"""
    
    # 硬體目前所處的狀態機狀態
    state: Optional[str] = None  # 對應 HardwareState 的字串值

    # 霍爾感測器數據：True 代表盒子被打開 (構成違規條件)
    box_open: bool = False

    # 雷達感測器數據：是否偵測到有人在前方
    radar_presence: bool = False

    # 時間相關資訊
    timestamp: Optional[int] = None
    uptime: Optional[int] = None  # 硬體從開機到現在的總運行秒數

    # 向下相容欄位 (支援舊版韌體格式)
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
    """細粒度的懲罰觸發配置：定義哪些感測器行為會觸發違規。"""
    enable_phone_penalty: bool = True     # 是否啟用手機移出懲罰
    enable_presence_penalty: bool = True  # 是否啟用人員離位懲罰
    enable_noise_penalty: bool = True     # 是否啟用噪音超標懲罰
    enable_box_open_penalty: bool = True  # 是否啟用盒子打開懲罰
    noise_threshold_db: int = 70          # 噪音判定的分貝閾值
    noise_duration_sec: int = 3           # 噪音需持續多久（秒）才觸發懲罰
    presence_duration_sec: int = 10       # 人員離位多久（秒）才觸發懲罰


class FocusSession(BaseModel):
    """單次專注任務的核心數據模型。"""
    id: str
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: SessionStatus = SessionStatus.IDLE
    violations: int = 0                    # 累計違規次數
    penalties_executed: int = 0            # 實際執行過的懲罰次數
    penalty_config: PenaltyConfig = PenaltyConfig()
    
    # 暫停與恢復追蹤相關
    paused_at: Optional[datetime] = None   # 上次暫停的時間點
    total_paused_seconds: int = 0          # 任務中累計的暫停總時長


class SocialPlatform(str, Enum):
    """支援的社群/通知平台清單。"""
    DISCORD = "discord"
    THREADS = "threads"
    GMAIL = "gmail"


class ProgressivePenaltyRule(BaseModel):
    """階段性懲罰規則：定義違規次數與觸發平台的對應關係。"""
    violation_count: int     # 違規次數門檻
    platforms: List[str]     # 觸發的平台列表


class PenaltySettings(BaseModel):
    """全域懲罰後果設定：定義違規後要執行的具體動作。"""
    enabled_platforms: List[SocialPlatform] = []
    custom_messages: dict = {
        "discord": "[警報] 我是一個沒有毅力的廢物，剛才的專注挑戰失敗了。請盡情嘲笑我。",
        "threads": "[系統公告] 使用者自律協定違規，專注任務執行失敗。這是恥辱的印記。",
        "gmail": "[專注執法者通報] 我無法完成專注任務，這是我的恥辱。"
    }
    gmail_recipients: List[str] = []       # 電子郵件收件人清單
    include_timestamp: bool = True         # 是否在訊息中包含時間戳記
    include_violation_count: bool = True   # 是否在訊息中包含違規次數
    progressive_rules: List[ProgressivePenaltyRule] = [
        ProgressivePenaltyRule(violation_count=1, platforms=['discord']),
        ProgressivePenaltyRule(violation_count=2, platforms=['discord', 'gmail']),
    ]  # 階段性懲罰規則


# ============================================================================
# 系統全域狀態模型
# ============================================================================
class SystemState(BaseModel):
    """應用程式當前的核心運作狀態匯整。"""
    session: Optional[FocusSession] = None
    phone_status: PhoneStatus = PhoneStatus.UNKNOWN
    presence_status: PresenceStatus = PresenceStatus.UNKNOWN
    box_status: BoxStatus = BoxStatus.UNKNOWN
    noise_status: NoiseStatus = NoiseStatus.UNKNOWN
    current_db: int = 40                   # 當前環境分貝值
    today_violation_count: int = 0         # 今日累計違規次數 (全域)
    last_sensor_data: Optional[SensorData] = None

    # 硬體端狀態同步
    hardware_state: HardwareState = HardwareState.IDLE

    # 任務啟動前的準備進度
    prepare_remaining_ms: int = 0          # 準備倒數剩餘毫秒數

    # 運算中間狀態
    person_away_since: Optional[datetime] = None
    noise_start_time: Optional[datetime] = None  # 記錄噪音開始持續的時間
    penalty_settings: PenaltySettings = PenaltySettings()
    penalty_config: PenaltyConfig = PenaltyConfig()  # 全域預設懲罰配置


class WebSocketMessage(BaseModel):
    """標準化的 WebSocket 訊息封裝格式。"""
    type: str
    payload: dict
