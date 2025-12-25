"""
Socket 管理模組
=====================
負責處理 Socket.IO 連線、事件分發與各個子系統間的協調。
此模組已進行重構，將具體邏輯委託給專門的模組處理：
- state_manager.py: 系統狀態管理
- violation_checker.py: 違規偵測與懲罰觸發
- mock_hardware.py: 虛擬硬體模擬邏輯
"""

from datetime import datetime
from typing import Optional, Callable, List, Dict, Any
import socketio

from .logger import safe_print
from .models import (
    SystemState, BoxStatus, SessionStatus, PenaltySettings, PenaltyConfig,
    HardwareState, NoiseStatus
)
from .state_manager import StateManager
from .violation_checker import ViolationChecker
from .mock_hardware import MockHardwareState, MockHardwareController
from .progressive_penalty import ProgressivePenaltyManager, PenaltyLevel
from .session_store import session_store, SessionRecord
from .daily_violation_store import daily_violation_store


class SocketManager:
    """核心 Socket.IO 管理器，負責協調所有子系統。

    主要功能包括：
    - 初始化 Socket.IO 伺服器並註冊事件處理程序
    - 管理前端客戶端與硬體端的連線
    - 將業務邏輯分發至對應的專業模組
    """

    def __init__(self) -> None:
        # 初始化 Socket.IO 異步伺服器
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            logger=False,
            engineio_logger=False
        )
        self.app = socketio.ASGIApp(self.sio)

        print("[Socket.IO] 伺服器已初始化")

        # 追蹤當前連線的前端客戶端 SID
        self.connected_clients: List[str] = []

        # 用於限制日誌輸出的頻率，避免過多重複資訊
        self.last_log_time: Dict[str, datetime] = {}
        self.log_throttle_seconds: float = 5.0

        # 初始化各個功能子系統
        self._state_manager = StateManager(
            log_callback=self._throttled_log
        )

        self._violation_checker = ViolationChecker(
            log_callback=self._throttled_log,
            broadcast_event_callback=self.broadcast_event
        )

        self._mock_state = MockHardwareState()
        self._mock_controller = MockHardwareController(
            state=self._mock_state,
            log_callback=self._throttled_log,
            broadcast_event_callback=self.broadcast_event,
            process_sensor_callback=self._process_sensor_internal,
            reset_state_callback=self._reset_system_state,
            build_status_callback=self._build_hardware_status
        )

        # 導入遞進式懲罰系統 (Phase 3 實作)
        self._progressive_penalty = ProgressivePenaltyManager()
        self._progressive_penalty.set_broadcast_callback(self._broadcast_penalty_state)
        self._setup_progressive_penalty_callbacks()

        # 追蹤當前違規狀態是否已經被記錄，防止重複計數
        self._current_violation_recorded = False

        # 註冊所有的 Socket 事件處理器
        self._setup_handlers()

    # =========================================================================
    # 屬性定義 (主要為了維持向後相容性與外部存取便利)
    # =========================================================================

    @property
    def state(self) -> SystemState:
        # 獲取當前全域系統狀態
        return self._state_manager.state

    @property
    def hardware_connected(self) -> bool:
        # 檢查硬體是否已連線
        return self._state_manager.hardware_connected

    @hardware_connected.setter
    def hardware_connected(self, value: bool) -> None:
        # 手動更新硬體連線狀態
        self._state_manager.hardware_connected = value

    @property
    def mock_mode_active(self) -> bool:
        # 檢查當前是否運行於模擬模式
        return self._mock_controller.active

    @property
    def mock_state(self) -> MockHardwareState:
        # 獲取模擬硬體的內部狀態
        return self._mock_state

    @property
    def current_hostage_path(self) -> Optional[str]:
        # 獲取目前「人質」照片的檔案路徑
        return self._violation_checker.current_hostage_path

    @current_hostage_path.setter
    def current_hostage_path(self, value: Optional[str]) -> None:
        # 設定「人質」照片的檔案路徑
        self._violation_checker.set_hostage_path(value)

    @property
    def physical_hardware_ws_connected(self) -> bool:
        # 檢查實體硬體的 WebSocket 是否維持連線
        return self._state_manager.physical_hardware_ws_connected

    @physical_hardware_ws_connected.setter
    def physical_hardware_ws_connected(self, value: bool) -> None:
        # 更新實體硬體 WebSocket 連線狀態
        self._state_manager.physical_hardware_ws_connected = value

    @property
    def progressive_penalty_state(self) -> dict:
        # 獲取遞進式懲罰系統的詳細數據
        return self._progressive_penalty.get_state_dict()

    @property
    def hardware_features(self) -> str:
        # 獲取硬體支援的功能列表字串
        return self._state_manager.hardware_features

    @property
    def hardware_firmware_version(self) -> str:
        # 獲取硬體韌體版本
        return self._state_manager.hardware_firmware_version

    # =========================================================================
    # 遞進式懲罰系統設定
    # =========================================================================

    def _setup_progressive_penalty_callbacks(self) -> None:
        # 初始化懲罰觸發行為

        async def handle_penalty(level, count, reason):
            # 廣播懲罰事件給前端，讓前端播放動畫
            # 注意：實際的懲罰訊息發送由前端動畫完成後透過 /api/penalty/execute 觸發
            # 移除此處對 penalty_callbacks 的直接呼叫，避免雙重發送
            safe_print(f"[懲罰] 🚨 違規懲罰 - {reason}")
            safe_print("[懲罰協定] 通知前端播放動畫，等待 API 呼叫執行實際發送...")

            await self.broadcast_event('penalty_level', {
                'level': 'PENALTY',
                'count': count,
                'today_count': daily_violation_store.get_count(),
                'reason': reason,
                'action': 'social_post'
            })

        # 註冊懲罰回調
        self._progressive_penalty.on_penalty(handle_penalty)
        
        # 設定懲罰後自動停止會話的回調
        self._progressive_penalty.set_stop_session_callback(self.stop_focus_session)

    async def _broadcast_penalty_state(self, data: dict) -> None:
        # 將懲罰狀態的異動即時通知前端
        await self.broadcast_event('penalty_state', data)

    # =========================================================================
    # 事件處理器註冊
    # =========================================================================

    def _setup_handlers(self) -> None:
        # 定義 Socket.IO 各項事件的監聽邏輯

        @self.sio.event
        async def connect(sid, environ):
            # 前端客戶端連線成功後，立即推送當前系統與硬體狀態
            self.connected_clients.append(sid)
            self._throttled_log('client_connect', f"[WS] 客戶端已連線: {sid}", force=True)
            await self.sio.emit('system_state', self._serialize_state(), room=sid)
            await self.sio.emit('hardware_status', self._build_hardware_status(), room=sid)

        @self.sio.event
        async def disconnect(sid):
            # 客戶端斷開連線，清理追蹤清單
            if sid in self.connected_clients:
                self.connected_clients.remove(sid)
            self._throttled_log('client_disconnect', f"[WS] 客戶端已斷開: {sid}", force=True)

        @self.sio.event
        async def hardware_connect(sid, data):
            # 處理實體硬體 (D1-mini) 發出的連線正式註冊事件
            if self.mock_mode_active:
                self._throttled_log('hw_ignored', "[硬體] 當前為模擬模式，忽略實體硬體連線請求", force=False)
                return

            hardware_id = data.get('hardware_id', 'UNKNOWN')
            version = data.get('version', 'N/A')
            board = data.get('board', 'D1-mini')
            features = data.get('features', '')

            # 根據硬體傳來的特徵字串判斷感測器配置
            hall_detected = 'hall' in features or data.get('hall_detected', True)
            radar_detected = 'radar' in features or data.get('radar_detected', True)
            lcd_detected = 'lcd' in features
            nfc_detected = data.get('nfc_detected', False)

            self._throttled_log('hw_connect', f"[硬體] 已上線 - ID: {hardware_id}, 版本: {version}, 開發板: {board}", force=True)

            self._state_manager.update_hardware_info(
                hardware_id=hardware_id,
                version=version,
                features=features,
                nfc_detected=nfc_detected,
                ldr_detected=hall_detected,
                radar_detected=radar_detected
            )

            await self.broadcast_event('hardware_status', self._build_hardware_status(
                hardware_id=hardware_id,
                version=version,
                board=board,
                features=features,
                lcd_detected=lcd_detected
            ))

        @self.sio.event
        async def heartbeat(sid, data):
            # 靜默處理硬體心跳包，不進行日誌記錄
            pass

        @self.sio.event
        async def state_change(sid, data):
            # 處理硬體內建狀態機的切換事件
            previous_state = data.get('previous_state', 'IDLE')
            current_state = data.get('current_state', 'IDLE')
            total_focus_time_ms = data.get('total_focus_time_ms', 0)

            self._throttled_log('state_change', f"[硬體狀態切換] {previous_state} → {current_state}", force=True)

            try:
                self._state_manager.state.hardware_state = HardwareState(current_state)
            except ValueError:
                self._state_manager.state.hardware_state = HardwareState.IDLE

            # 如果硬體判定進入違規(VIOLATION)狀態，觸發後端違規檢核
            if current_state == 'VIOLATION':
                if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
                    self._throttled_log('hw_violation', "[硬體] 硬體端主動回報違規！", force=True)
                    self._state_manager.state.box_status = BoxStatus.OPEN
                    # 使用進階懲罰系統記錄違規（會調用 daily_violation_store.increment()）
                    await self._progressive_penalty.record_violation("硬體偵測違規")
            elif current_state == 'FOCUSING':
                # 恢復專注狀態，通知遞進懲罰系統違規已解除
                self._state_manager.state.box_status = BoxStatus.CLOSED
                await self._progressive_penalty.violation_resolved()

                if self.state.session and self.state.session.status == SessionStatus.VIOLATED:
                    self.state.session.status = SessionStatus.ACTIVE
                    print("[專注協定] 違規已修正，恢復專注狀態")

            await self.broadcast_state(force=True)
            await self.broadcast_event('hardware_state_change', {
                'previous_state': previous_state,
                'current_state': current_state,
                'total_focus_time_ms': total_focus_time_ms
            })

        @self.sio.event
        async def sensor_data(sid, data):
            # 接收並處理硬體原始感測器數據
            if self.mock_mode_active:
                return

            ldr_detected = data.get('ldr_detected', False)
            if ldr_detected is not None:
                data['ldr_detected'] = ldr_detected

            await self.process_sensor_data(data)

        @self.sio.event
        async def start_session(sid, data):
            # 前端請求開始新的專注任務
            duration = data.get('duration_minutes', 25)
            await self.start_focus_session(duration)

        @self.sio.event
        async def stop_session(sid, data):
            # 前端請求終止專注任務
            await self.stop_focus_session()

        @self.sio.event
        async def update_penalty_settings(sid, data):
            # 更新全域懲罰開關設定
            try:
                self._state_manager.state.penalty_settings = PenaltySettings(**data)
                self._state_manager.save_settings()
                await self.broadcast_state(force=True)
            except Exception as e:
                print(f"[錯誤] 更新懲罰開關失敗: {e}")

        @self.sio.event
        async def update_penalty_config(sid, data):
            # 更新細粒度的懲罰類型設定
            try:
                self._state_manager.state.penalty_config = PenaltyConfig(**data)
                if self.state.session:
                    self.state.session.penalty_config = self.state.penalty_config
                self._state_manager.save_settings()
                print(f"[懲罰配置] 已更新: {self.state.penalty_config.model_dump()}")
                await self.broadcast_state(force=True)
            except Exception as e:
                print(f"[錯誤] 更新懲罰細節配置失敗: {e}")

        @self.sio.event
        async def toggle_mock_hardware(sid, data):
            # 開啟或關閉硬體模擬模式
            enabled = data.get('enabled', False)
            print(f"[模擬器] 切換請求: 客戶端要求啟用={enabled}, 當前狀態={self.mock_mode_active}")
            if enabled:
                await self.start_mock_hardware()
            else:
                await self.stop_mock_hardware()

    # =========================================================================
    # 感測器數據處理
    # =========================================================================

    async def _process_sensor_internal(self, data: Dict[str, Any]) -> None:
        # 用於驅動模擬器數據注入的內部回呼
        await self.process_sensor_data(data)

    async def process_sensor_data(self, data: Dict[str, Any]) -> None:
        # 處理任何來源（實體或模擬）的感測器數據並更新全域狀態
        sensor = self._state_manager.process_sensor_data(data, self.mock_mode_active)
        if sensor is None:
            return

        # 每次數據更新後檢查是否觸發違規
        # 使用進階懲罰系統來檢測違規，而不是舊的 violation_checker
        if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
            # 檢查各項違規條件
            config = self.state.session.penalty_config
            violation_detected = False
            violation_reason = ""
            
            # 1. 檢查手機是否被移除
            if config.enable_phone_penalty and self.state.phone_status.value == 'REMOVED':
                violation_detected = True
                violation_reason = "手機被移出"
            # 2. 檢查人員是否離開位置
            elif config.enable_presence_penalty and self.state.person_away_since:
                from datetime import datetime
                away_duration = (datetime.now() - self.state.person_away_since).total_seconds()
                if away_duration > config.presence_duration_sec:
                    violation_detected = True
                    violation_reason = f"人員離位 {away_duration:.1f} 秒"
            # 3. 檢查盒子是否被打開
            elif config.enable_box_open_penalty and self.state.box_status.value == 'OPEN':
                violation_detected = True
                violation_reason = "盒子被打開"
            # 4. 檢查噴音持續違規
            elif config.enable_noise_penalty and self.state.noise_status.value == 'NOISY':
                if self.state.noise_start_time:
                    from datetime import datetime
                    noise_duration = (datetime.now() - self.state.noise_start_time).total_seconds()
                    if noise_duration > config.noise_duration_sec:
                        violation_detected = True
                        violation_reason = f"噴音違規 ({self.state.current_db} dB)"
                        self._state_manager.state.noise_start_time = None
            
            if violation_detected:
                # 只有新的違規才會觸發記錄，避免同一違規事件被重複計數
                if not self._current_violation_recorded:
                    self._current_violation_recorded = True
                    await self._progressive_penalty.record_violation(violation_reason)
            else:
                # 違規狀態已解除，重置標記
                if self._current_violation_recorded:
                    self._current_violation_recorded = False
                    await self._progressive_penalty.violation_resolved()
        
        await self.broadcast_state()

    # =========================================================================
    # 專注任務管理
    # =========================================================================

    async def start_focus_session(self, duration_minutes: int, hostage_path: Optional[str] = None) -> None:
        # 重置噪音計時器，確保新協定不受前一次協定殘留狀態影響
        self._state_manager.state.noise_start_time = None

        # 啟動專注流程：重置計時器、初始化懲罰鏈結、更新狀態
        self._violation_checker.set_hostage_path(hostage_path)

        self._violation_checker.reset_penalty_timer()

        # 開始新的遞進式懲罰追蹤
        self._progressive_penalty.start_session()

        self._state_manager.start_session(duration_minutes)

        # 修復：檢查協定啟動時的環境音量狀態
        # 如果目前環境音量已超過閾值，立即開始噪音計時
        if self._state_manager.state.noise_status == NoiseStatus.NOISY:
            self._state_manager.state.noise_start_time = datetime.now()
            print("[專注協定] 偵測到環境音量已超標，開始計時...")

        print(f"[專注協定] 已啟動 {duration_minutes} 分鐘專注任務")
        print(f"[專注協定] 懲罰配置: {self.state.penalty_config.model_dump()}")
        print(f"[專注協定] 遞進懲罰已啟用 (5秒寬限期)")
        print(f"[專注協定] 今日違規次數: {daily_violation_store.get_count()}")
        if hostage_path:
            print(f"[人質協定] 人質照片已綁定: {hostage_path}")

        await self.broadcast_state(force=True)
        await self.sio.emit('command', {'command': 'START'})

    async def stop_focus_session(self) -> None:
        # 停止當前任務，並將紀錄持久化存檔
        session = self.state.session

        if session:
            print("[專注協定] 專注任務已結束")

            try:
                record = SessionRecord(
                    id=session.id,
                    start_time=session.start_time.isoformat() if session.start_time else datetime.now().isoformat(),
                    end_time=datetime.now().isoformat(),
                    duration_minutes=session.duration_minutes,
                    status=session.status.value if session.status else "COMPLETED",
                    violation_count=self._progressive_penalty.get_state_dict().get('count', 0),
                    penalty_level=str(self._progressive_penalty.get_state_dict().get('level', 'NONE')),
                    total_focus_time_seconds=int(session.elapsed_seconds or 0)
                )
                session_store.add_session(record)
                print(f"[歷史紀錄] 任務 {session.id} 已存入資料庫")
            except Exception as e:
                print(f"[歷史紀錄] 存檔失敗: {e}")

        # 停止專注時同步停止懲罰追蹤
        self._progressive_penalty.stop_session()

        self._state_manager.stop_session()
        self._violation_checker.set_hostage_path(None)

        await self.sio.emit('command', {'command': 'STOP'})
        await self.broadcast_state(force=True)

    async def pause_focus_session(self) -> None:
        # 暫停專注任務（v1.0 新功能）
        if self._state_manager.pause_session():
            await self.sio.emit('command', {'command': 'PAUSE'})
            print(f"[專注協定] 專注任務已暫停 - 時間點: {self.state.session.paused_at.isoformat()}")
            await self.broadcast_state(force=True)

    async def resume_focus_session(self) -> None:
        # 恢復已被暫停的任務
        if self._state_manager.resume_session():
            await self.sio.emit('command', {'command': 'RESUME'})
            print("[專注協定] 專注任務已恢復")
            await self.broadcast_state(force=True)

    async def acknowledge_violation(self) -> None:
        # 前端手動確認違規狀態並返回首頁
        if self.state.session and self.state.session.status == SessionStatus.VIOLATED:
            await self.sio.emit('command', {'command': 'ACKNOWLEDGE'})
            print("[專注協定] 違規已確認，系統返回待機")

    # =========================================================================
    # 硬體模擬控制
    # =========================================================================

    async def start_mock_hardware(self) -> None:
        # 啟動虛擬硬體，並根據需要接管實體硬體的權限
        if self._state_manager.hardware_connected and not self.mock_mode_active:
            print("[模擬器] 偵測到實體硬體連線中 - 強制切換為模擬模式")
            print("[模擬器] 之後將完全忽略來自實體開發板的數據流")

        def set_connected(value: bool):
            self._state_manager.hardware_connected = value

        await self._mock_controller.start(set_connected)

    async def stop_mock_hardware(self) -> None:
        # 停止模擬硬體，若實體硬體仍有連線則切換回實體連線狀態
        def set_connected(value: bool):
            self._state_manager.hardware_connected = value

        await self._mock_controller.stop(
            set_connected,
            self._state_manager.physical_hardware_ws_connected
        )

    async def set_mock_state(self, **kwargs) -> Dict[str, Any]:
        # 更新虛擬硬體的內部感測值（由前端模擬面板操作）
        return await self._mock_controller.set_state(
            broadcast_state_callback=lambda: self.broadcast_state(force=True),
            **kwargs
        )

    # =========================================================================
    # 狀態廣播機制
    # =========================================================================

    def _serialize_state(self) -> Dict[str, Any]:
        # 將 Pydantic 模型狀態序列化為 JSON 友善格式
        return self._state_manager.serialize_state()

    async def broadcast_state(self, force: bool = False) -> None:
        # 將最新系統狀態分發給所有前端連線
        if not force and not self._state_manager.should_broadcast():
            return

        self._state_manager.mark_broadcast()
        await self.sio.emit('system_state', self._serialize_state())

    async def broadcast_event(self, event: str, data: Dict[str, Any]) -> None:
        # 發送通用自定義事件
        await self.sio.emit(event, data)

    # =========================================================================
    # 硬體狀態彙整
    # =========================================================================

    def get_sensor_detection_status(self) -> tuple:
        # 根據模式決定目前應呈現哪些感測器被「偵測到」
        return self._state_manager.get_sensor_detection_status(self.mock_mode_active)

    def _build_hardware_status(self, **overrides) -> Dict[str, Any]:
        # 構建傳送給前端的詳細硬體診斷資訊包
        nfc_detected, ldr_detected, radar_detected = self.get_sensor_detection_status()

        # 模擬模式時視為「已連線」且硬體狀態為可用
        is_connected = self._state_manager.hardware_connected or self.mock_mode_active

        status = {
            'connected': is_connected,
            'mock_mode': self.mock_mode_active,
            'mock_state': self._mock_state.to_dict(),
            'nfc_detected': nfc_detected,
            'ldr_detected': ldr_detected,
            'hall_detected': ldr_detected,
            'ir_detected': ldr_detected,
            'radar_detected': radar_detected,
            'lcd_detected': 'lcd' in self._state_manager.hardware_features,
            'hardware_state': self.state.hardware_state.value,
            'firmware_version': self._state_manager.hardware_firmware_version
        }

        status.update(overrides)
        return status

    # =========================================================================
    # 輔助工具方法
    # =========================================================================

    def _throttled_log(self, log_key: str, message: str, force: bool = False) -> None:
        # 對高頻日誌進行節流處理，避免終端機刷屏
        if force:
            print(message)
            return

        now = datetime.now()
        last_time = self.last_log_time.get(log_key)

        if last_time is None or (now - last_time).total_seconds() >= self.log_throttle_seconds:
            print(message)
            self.last_log_time[log_key] = now

    async def _reset_system_state(self) -> None:
        # 在硬體模式切換（模擬/實體）時執行狀態清零
        self._state_manager.reset_state()
        await self.broadcast_state(force=True)

    def register_penalty_callback(self, callback: Callable) -> None:
        # 讓外部模組（如 social_manager）註冊懲罰執行的行為
        self._violation_checker.register_callback(callback)


# 全域單例實例，確保整個後端共用同一個 Socket 管理器
socket_manager = SocketManager()
