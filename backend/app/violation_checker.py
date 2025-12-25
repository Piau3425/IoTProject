"""
違規檢查模組
========================
處理違規偵測邏輯以及懲罰觸發機制。
從 socket_manager.py 抽離出來，確保邏輯模組化。
"""

from datetime import datetime
from typing import Callable, List, Optional

from .models import (
    SystemState, PhoneStatus, BoxStatus, NoiseStatus,
    SessionStatus, PenaltyConfig
)
from .config import settings
from .logger import safe_print


class ViolationChecker:
    """檢查專注任務中的違規行為並決定是否觸發懲罰。

    主要職責：
    - 根據感測器狀態與個別處罰設定，判斷當前是否發生違規
    - 管理懲罰冷卻時間，避免短時間內重複觸發
    - 當違規成立時，依序執行註冊的懲罰回呼函式

    屬性：
    - last_penalty_time: 上一次觸發懲罰的時間戳記
    - penalty_cooldown_seconds: 兩次懲罰間的最短間隔秒數
    - penalty_callbacks: 觸發懲罰時需執行的異步函式列表
    """

    def __init__(
        self,
        log_callback: Callable[[str, str, bool], None],
        broadcast_event_callback: Callable,
        penalty_cooldown_seconds: int = 30
    ) -> None:
        """初始化違規檢查器。

        Args:
            log_callback: 紀錄日誌的函式 (key, message, force)
            broadcast_event_callback: 發送 Socket 事件的異步函式
            penalty_cooldown_seconds: 懲罰觸發冷卻時間（秒）
        """
        self._log = log_callback
        self._broadcast_event = broadcast_event_callback
        self.penalty_cooldown_seconds = penalty_cooldown_seconds

        self.last_penalty_time: Optional[datetime] = None
        self.penalty_callbacks: List[Callable] = []
        self.current_hostage_path: Optional[str] = None

    def register_callback(self, callback: Callable) -> None:
        """註冊一個懲罰執行函式。

        Args:
            callback: 觸發懲罰時要呼叫的異步函式。
                     該函式需接收 (state: SystemState, hostage_path: Optional[str]) 參數。
        """
        self.penalty_callbacks.append(callback)

    def set_hostage_path(self, path: Optional[str]) -> None:
        """設定當前「人質」圖片的路徑。

        Args:
            path: 人質照片的檔案路徑，傳入 None 則清除
        """
        self.current_hostage_path = path

    def reset_penalty_timer(self) -> None:
        """重置懲罰冷卻計時器，立即使下一次違規生效。"""
        self.last_penalty_time = None

    def _check_penalty_cooldown(self) -> tuple[bool, float]:
        """檢查目前是否已過懲罰冷卻期。

        Returns:
            Tuple: (是否可觸發, 剩餘冷卻秒數)
        """
        now = datetime.now()
        if self.last_penalty_time is None:
            return True, 0.0

        elapsed = (now - self.last_penalty_time).total_seconds()
        if elapsed >= self.penalty_cooldown_seconds:
            return True, 0.0

        return False, self.penalty_cooldown_seconds - elapsed

    def _detect_violations(
        self,
        state: SystemState,
        config: PenaltyConfig
    ) -> tuple[bool, str]:
        """偵測目前各項感測數據是否構成違規。

        Returns:
            Tuple: (是否偵測到違規, 違規原因說明)
        """
        # 1. 檢查手機是否被移除
        if config.enable_phone_penalty and state.phone_status == PhoneStatus.REMOVED:
            self._log('violation_phone', "[違規] 專注期間手機已被移出盒子！", False)
            return True, "手機被移出"

        # 2. 檢查人員是否離開位置
        if config.enable_presence_penalty and state.person_away_since:
            away_duration = (datetime.now() - state.person_away_since).total_seconds()
            if away_duration > config.presence_duration_sec:
                self._log('violation_away', f"[違規] 人員離開位置超過 {away_duration:.1f} 秒！", False)
                return True, f"人員離位 {away_duration:.1f} 秒"

        # 3. 檢查盒子是否被打開
        if config.enable_box_open_penalty and state.box_status == BoxStatus.OPEN:
            self._log('violation_box_open', "[違規] 專注期間盒子已被打開！", False)
            return True, "盒子被打開"

        # 4. 檢查環境噪音水平
        if config.enable_noise_penalty and state.noise_status == NoiseStatus.NOISY:
            # 如果是剛開始偵測到噪音，記錄起始時間
            if not state.noise_start_time:
                state.noise_start_time = datetime.now()
            
            noise_duration = (datetime.now() - state.noise_start_time).total_seconds()
            # 噪音持續時間超過設定閾值才算違規
            if noise_duration > config.noise_duration_sec:
                self._log('violation_noise', f"[違規] 噪音違規 ({state.current_db} dB 持續 {noise_duration:.1f} 秒)！", False)
                state.noise_start_time = None
                return True, f"偵測到噪音 ({state.current_db} dB)"
        else:
            # 恢復安靜時重置計時器
            state.noise_start_time = None

        return False, ""

    async def check_and_trigger(self, state: SystemState) -> bool:
        """執行完整的違規檢核與懲罰觸發流程。

        Args:
            state: 當前全域系統狀態

        Returns:
            bool: 是否實際觸發了懲罰
        """
        # 僅在專注任務進行中且非暫停狀態下進行檢查
        if not state.session or state.session.status != SessionStatus.ACTIVE:
            return False

        config = state.session.penalty_config
        violation_detected, violation_reason = self._detect_violations(state, config)

        if not violation_detected:
            return False

        # 檢查是否處於冷卻期，避免短時間內瘋狂處罰
        can_trigger, remaining = self._check_penalty_cooldown()
        if not can_trigger:
            safe_print(f"[違規] 懲罰冷卻中（剩餘 {remaining:.1f} 秒）")
            return False

        # 正式標記違規並更新 session 狀態
        state.session.violations += 1
        state.session.status = SessionStatus.VIOLATED
        self.last_penalty_time = datetime.now()

        safe_print(f"[違規] 啟動懲罰流程，原因：{violation_reason}")
        await self._trigger_penalty(state)

        return True

    async def _trigger_penalty(self, state: SystemState) -> None:
        """廣播懲罰事件給前端，讓前端播放動畫。
        
        注意：實際的懲罰訊息發送將由前端動畫完成後透過 API 觸發，
        以確保用戶能看到完整的動畫流程後才收到通知。
        """
        safe_print("[懲罰協定] 偵測到違規，通知前端開始懲罰動畫...")

        # 通知所有前端目前的懲罰狀態
        from .daily_violation_store import daily_violation_store
        today_count = daily_violation_store.get_count()
        await self._broadcast_event('penalty_triggered', {
            'timestamp': datetime.now().isoformat(),
            'violations': today_count,
            'session_violations': state.session.violations if state.session else 0,
            'has_hostage': self.current_hostage_path is not None,
            'today_violation_count': today_count
        })

        # 注意：懲罰回調不在此處執行
        # 前端動畫完成後會呼叫 /api/penalty/execute 來觸發實際發送
        safe_print("[懲罰協定] 已通知前端，等待動畫完成後執行實際發送")

        if state.session:
            state.session.penalties_executed += 1

