"""
狀態管理模組
====================
負責系統狀態的序列化、更新以及廣播節流控制。
從 socket_manager.py 抽離出來，以實現更好的關注點分離。
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

from .models import (
    SystemState, SensorData, PhoneStatus, PresenceStatus,
    BoxStatus, NoiseStatus, HardwareState, SessionStatus,
    FocusSession, PenaltySettings, PenaltyConfig
)

from .daily_violation_store import daily_violation_store


class StateManager:
    """管理系統全域狀態與感測器數據處理。
    
    具體職責包括：
    - 解析原始感測器數據並更新對應的系統狀態欄位
    - 準備要傳輸給前端的狀態序列化數據
    - 追蹤硬體連線狀態（包含模擬與實體）
    - 管理廣播頻率，避免頻率過高導致前端負載過重
    - 設定檔的讀取與持久化存檔
    """

    # 設定檔存放路徑
    CONFIG_FILE = Path("config/settings.json")

    def __init__(
        self,
        log_callback,
        initial_state: Optional[SystemState] = None
    ) -> None:
        """初始化狀態管理器。

        Args:
            log_callback: 用於記錄日誌的回呼函式 (key, message, force)
            initial_state: 可選的初始系統狀態
        """
        self._log = log_callback
        self.state = initial_state or SystemState()

        # 硬體連線相關追蹤欄位
        self.hardware_connected: bool = False
        self.physical_hardware_ws_connected: bool = False
        self.hardware_firmware_version: str = "unknown"
        self.hardware_features: str = ""

        # 實體感測器的偵測狀態
        self.physical_nfc_detected: bool = False
        self.physical_ldr_detected: bool = False
        self.physical_radar_detected: bool = True

        # 廣播節流機制設定
        self.last_broadcast_time: Optional[datetime] = None
        self.broadcast_throttle_ms: int = 200
        
        # 啟動時先載入上次保存的設定
        self.load_settings()

    def load_settings(self) -> None:
        """從 JSON 檔案載入系統設定。"""
        try:
            if self.CONFIG_FILE.exists():
                with open(self.CONFIG_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                if 'penalty_settings' in data:
                    # 使用 Pydantic 模型進行預設驗證
                    self.state.penalty_settings = PenaltySettings(**data['penalty_settings'])
                    
                if 'penalty_config' in data:
                    self.state.penalty_config = PenaltyConfig(**data['penalty_config'])
                    
                self._log('settings_loaded', "[系統] 已從檔案載入設定內容", False)
        except Exception as e:
            self._log('settings_load_error', f"[錯誤] 載入設定檔失敗: {e}", True)

    def save_settings(self) -> None:
        """將當前設定保存到 JSON 檔案中。"""
        try:
            self.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
            
            data = {
                'penalty_settings': self.state.penalty_settings.model_dump(),
                'penalty_config': self.state.penalty_config.model_dump()
            }
            
            with open(self.CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            self._log('settings_saved', "[系統] 設定內容已保存至檔案", False)
        except Exception as e:
            self._log('settings_save_error', f"[錯誤] 保存設定檔失敗: {e}", True)

    def serialize_state(self) -> Dict[str, Any]:
        """序列化系統狀態以供傳輸。

        將內部狀態模型轉換為字典格式，並處理 datetime 對象的轉換。
        """
        state_dict = self.state.model_dump()

        # 將日期時間對象轉換為 ISO 格式字串，前端才能正常解析
        if self.state.session:
            if self.state.session.start_time:
                state_dict['session']['start_time'] = self.state.session.start_time.isoformat()
            if self.state.session.end_time:
                state_dict['session']['end_time'] = self.state.session.end_time.isoformat()
            if self.state.session.paused_at:
                state_dict['session']['paused_at'] = self.state.session.paused_at.isoformat()

        if self.state.person_away_since:
            state_dict['person_away_since'] = self.state.person_away_since.isoformat()

        # 噪音開始時間也需要轉換為 ISO 格式
        if self.state.noise_start_time:
            state_dict['noise_start_time'] = self.state.noise_start_time.isoformat()

        # 將列舉值轉換為其背後的原始值
        state_dict['hardware_state'] = self.state.hardware_state.value
        state_dict['today_violation_count'] = daily_violation_store.get_count()

        return state_dict

    def should_broadcast(self) -> bool:
        """判斷距離上次廣播是否已超過節流間隔。

        用於控制 Socket 推送頻率，避免網路擁塞。
        """
        now = datetime.now()
        if self.last_broadcast_time:
            elapsed_ms = (now - self.last_broadcast_time).total_seconds() * 1000
            if elapsed_ms < self.broadcast_throttle_ms:
                return False
        return True

    def mark_broadcast(self) -> None:
        """標記目前時間為最後一次廣播時間。"""
        self.last_broadcast_time = datetime.now()

    def get_sensor_detection_status(self, mock_mode_active: bool) -> tuple[bool, bool, bool]:
        """獲取各感測器的當前偵測可用性狀態。

        回傳格式: (nfc_detected, ldr_detected, radar_detected)
        """
        if mock_mode_active:
            # 模擬模式下假定所有感測器皆可用
            return True, True, True
        elif self.hardware_connected:
            return (
                self.physical_nfc_detected,
                self.physical_ldr_detected,
                self.physical_radar_detected
            )
        else:
            return False, False, False

    def reset_state(self) -> None:
        """將系統狀態重置為初始預設值（通常用於切換實體/模擬模式時）。"""
        self.state.last_sensor_data = None
        self.state.current_db = 40
        self.state.phone_status = PhoneStatus.UNKNOWN
        self.state.presence_status = PresenceStatus.UNKNOWN
        self.state.box_status = BoxStatus.UNKNOWN
        self.state.noise_status = NoiseStatus.UNKNOWN
        self.state.person_away_since = None
        self._log('state_reset', "[系統] 由於硬體模式切換，全域狀態已重置", True)

    def update_hardware_info(
        self,
        hardware_id: str,
        version: str,
        features: str,
        nfc_detected: bool,
        ldr_detected: bool,
        radar_detected: bool
    ) -> None:
        """更新硬體的連線與能力資訊。"""
        self.hardware_connected = True
        self.physical_hardware_ws_connected = True
        self.hardware_firmware_version = version
        self.hardware_features = features
        self.physical_nfc_detected = nfc_detected
        self.physical_ldr_detected = ldr_detected
        self.physical_radar_detected = radar_detected

    def process_sensor_data(
        self,
        data: Dict[str, Any],
        mock_mode_active: bool
    ) -> Optional[SensorData]:
        """處理傳入的感測器原始數據，並更新對應的系統狀態屬性。"""
        try:
            # 正規化 nfc_id：將空字串視為無標籤 (None)
            if 'nfc_id' in data and data['nfc_id'] == '':
                data['nfc_id'] = None

            # 相容性處理：v1.0 使用 box_locked，新版本統稱為 box_open
            if 'box_open' not in data:
                data['box_open'] = not data.get('box_locked', True)

            sensor = SensorData(**data)
            self.state.last_sensor_data = sensor
            self.state.current_db = sensor.mic_db

            # 從感測數據中同步更新硬體內部的狀態機狀態
            if sensor.state:
                try:
                    self.state.hardware_state = HardwareState(sensor.state)
                except ValueError:
                    pass

            # 依序更新各個子狀態
            self._update_phone_status(sensor, mock_mode_active)
            self._update_presence_status(sensor)
            self._update_box_status(sensor)
            self._update_noise_status(sensor)

            return sensor

        except Exception as e:
            import traceback
            print(f"[錯誤] 感測器數據解析失敗: {e}")
            print(f"[錯誤] 堆疊追蹤: {traceback.format_exc()}")
            print(f"[錯誤] 原始數據內容: {data}")
            return None

    def _update_phone_status(self, sensor: SensorData, mock_mode_active: bool) -> None:
        """依據感測器數據更新手機鎖定狀態。"""
        if mock_mode_active:
            # 模擬模式：開蓋不會導致 NFC 訊號遺失，主要看 NFC ID 是否存在
            if sensor.nfc_id:
                if self.state.phone_status != PhoneStatus.LOCKED:
                    self._log('phone_locked', "[狀態] ✓ 手機已放入盒子並鎖定", True)
                self.state.phone_status = PhoneStatus.LOCKED
            else:
                if self.state.phone_status == PhoneStatus.LOCKED:
                    self.state.phone_status = PhoneStatus.REMOVED
                    self._log('phone_removed', "[警報] ⚠️  手機已被移出盒子！", True)
                else:
                    self.state.phone_status = PhoneStatus.REMOVED
        else:
            # 實體模式：受硬體特性影響，開蓋可能導致 NFC 天線訊號不穩，因此開蓋或無 ID 皆視為移出
            if sensor.nfc_id and not sensor.box_open:
                if self.state.phone_status != PhoneStatus.LOCKED:
                    self._log('phone_locked', "[狀態] ✓ 手機已放入盒子並鎖定", True)
                self.state.phone_status = PhoneStatus.LOCKED
            elif not sensor.nfc_id or sensor.box_open:
                if self.state.phone_status == PhoneStatus.LOCKED:
                    self.state.phone_status = PhoneStatus.REMOVED
                    self._log('phone_removed', "[警報] ⚠️  手機已被移出盒子！", True)
                else:
                    self.state.phone_status = PhoneStatus.REMOVED

    def _update_presence_status(self, sensor: SensorData) -> None:
        """依據雷達感測值更新人員在位狀態。"""
        if sensor.radar_presence:
            if self.state.presence_status != PresenceStatus.DETECTED:
                self._log('person_detected', "[狀態] ✓ 偵測到人員在位", True)
            self.state.presence_status = PresenceStatus.DETECTED
            self.state.person_away_since = None
        else:
            if self.state.presence_status == PresenceStatus.DETECTED:
                self.state.person_away_since = datetime.now()
                self._log('person_away', "[狀態] ⚠️  人員離開 - 開始計時監控...", True)
            self.state.presence_status = PresenceStatus.AWAY

    def _update_box_status(self, sensor: SensorData) -> None:
        """依據 LDR/紅外線感測值更新盒子開關狀態。"""
        if sensor.box_open:
            if self.state.box_status != BoxStatus.OPEN:
                self._log('box_open', "[警報] ⚠️  盒子已被打開！", True)
            self.state.box_status = BoxStatus.OPEN
        else:
            if self.state.box_status != BoxStatus.CLOSED:
                self._log('box_closed', "[狀態] ✓ 盒子已關閉", True)
            self.state.box_status = BoxStatus.CLOSED

    def _update_noise_status(self, sensor: SensorData) -> None:
        """依據麥克風分貝值更新環境噪音狀態。"""
        noise_threshold = self.state.penalty_config.noise_threshold_db
        if sensor.mic_db >= noise_threshold:
            if self.state.noise_status != NoiseStatus.NOISY:
                self._log('noise_detected', f"[警報] ⚠️  偵測到環境噪音過大 ({sensor.mic_db} dB)", True)
            self.state.noise_status = NoiseStatus.NOISY
        else:
            self.state.noise_status = NoiseStatus.QUIET

    # 專注任務相關管理方法

    def start_session(self, duration_minutes: int) -> FocusSession:
        """初始化並啟動一個新的專注任務。"""
        import uuid

        self.state.session = FocusSession(
            id=str(uuid.uuid4()),
            duration_minutes=duration_minutes,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE,
            penalty_config=self.state.penalty_config
        )

        return self.state.session

    def stop_session(self) -> None:
        """終結當前運行中的專注任務。"""
        if self.state.session:
            self.state.session.status = SessionStatus.COMPLETED
            self.state.session.end_time = datetime.now()
            self.state.session = None

    def pause_session(self) -> bool:
        """暫停當前的專注任務。"""
        if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
            self.state.session.paused_at = datetime.now()
            self.state.session.status = SessionStatus.PAUSED
            return True
        return False

    def resume_session(self) -> bool:
        """從暫停狀態恢復專注任務，並計算暫停時長。"""
        if self.state.session and self.state.session.status == SessionStatus.PAUSED:
            if self.state.session.paused_at:
                paused_duration = (datetime.now() - self.state.session.paused_at).total_seconds()
                self.state.session.total_paused_seconds += int(paused_duration)
                self.state.session.paused_at = None

            self.state.session.status = SessionStatus.ACTIVE
            return True
        return False
