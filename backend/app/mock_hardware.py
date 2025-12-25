"""
模擬硬體模組
====================
提供虛擬硬體模擬功能，讓開發者在沒有實體 ESP32 裝置的情況下也能進行測試。
本模組負責產出模擬的感測器數據，並由 SocketManager 統一處理。
"""

import asyncio
import random
from datetime import datetime
from typing import TYPE_CHECKING, Optional, Callable, Dict, Any

from .config import settings

if TYPE_CHECKING:
    from .socket_manager import SocketManager


class MockHardwareState:
    """模擬硬體的持久狀態。

    用於儲存當前模擬出來的環境數據。
    屬性：
        phone_inserted: 手機是否已「放入」盒子內
        person_present: 雷達是否「偵測」到有人
        nfc_valid: NFC 標籤是否合法
        box_locked: (Legacy) 盒子是否被鎖上
        box_open: 盒子是否被「打開」（對應紅外線或霍爾感測器）
        manual_mode: 是否處於手動控制模式（不走隨機變化）
    """

    def __init__(self) -> None:
        self.phone_inserted: bool = True
        self.person_present: bool = True
        self.nfc_valid: bool = True
        self.box_locked: bool = True
        self.box_open: bool = False
        self.manual_mode: bool = False
        self.noise_min: int = 35
        self.noise_max: int = 55

    def to_dict(self) -> Dict[str, Any]:
        """將目前狀態轉換為字典格式，方便 JSON 序列化。"""
        return {
            'phone_inserted': self.phone_inserted,
            'person_present': self.person_present,
            'nfc_valid': self.nfc_valid,
            'box_locked': self.box_locked,
            'box_open': self.box_open,
            'manual_mode': self.manual_mode,
            'noise_min': self.noise_min,
            'noise_max': self.noise_max
        }

    def reset(self) -> None:
        """重置所有模擬狀態為預設的「完美專注」狀態。"""
        self.phone_inserted = True
        self.person_present = True
        self.nfc_valid = True
        self.box_locked = True
        self.box_open = False
        self.manual_mode = False


class MockHardwareController:
    """模擬硬體控制器。

    負責管理模擬循環 (Loop) 以及與父層 SocketManager 的通訊。
    """

    def __init__(
        self,
        state: MockHardwareState,
        log_callback: Callable[[str, str, bool], None],
        broadcast_event_callback: Callable,
        process_sensor_callback: Callable,
        reset_state_callback: Callable,
        build_status_callback: Callable
    ) -> None:
        """初始化控制器。

        參數：
            state: 持久化的模擬狀態實例
            log_callback: 輸出日誌到控制台的函式
            broadcast_event_callback: 向前端廣播 Socket 事件的異步函式
            process_sensor_callback: 核心感測器數據處理邏輯
            reset_state_callback: 重置系統狀態的函式
            build_status_callback: 生成硬體連線資訊摘要的函式
        """
        self.state = state
        self._log = log_callback
        self._broadcast_event = broadcast_event_callback
        self._process_sensor = process_sensor_callback
        self._reset_state = reset_state_callback
        self._build_status = build_status_callback

        self.mock_task: Optional[asyncio.Task] = None
        self.active: bool = False

    def _generate_sensor_data(self) -> Dict[str, Any]:
        """根據目前的模擬狀態，合成對應的原始感測器封包。"""
        return {
            'nfc_id': 'PHONE_MOCK_001' if (self.state.phone_inserted and self.state.nfc_valid) else None,
            'gyro_x': 0.0,
            'gyro_y': 0.0,
            'gyro_z': 0.0,
            'radar_presence': self.state.person_present,
            'mic_db': random.randint(self.state.noise_min, self.state.noise_max),
            'box_locked': not self.state.box_open,
            'box_open': self.state.box_open,
            'timestamp': int(datetime.now().timestamp() * 1000),
            'nfc_detected': True,
            'gyro_detected': False,
            'ldr_detected': True
        }

    async def start(self, hardware_connected_setter: Callable[[bool], None]) -> None:
        """啟動硬體模擬任務。"""
        if self.active:
            self._log('mock_already_running', "[模擬] 硬體模擬任務已在運行中", False)
            await self._broadcast_event('hardware_status', self._build_status())
            return

        try:
            self.active = True
            await self._reset_state()

            # 若先前有殘留任務，先進行清理
            if self.mock_task and not self.mock_task.done():
                self.mock_task.cancel()
                try:
                    await self.mock_task
                except asyncio.CancelledError:
                    pass

            # 啟動異步循環
            self.mock_task = asyncio.create_task(self._loop())
            hardware_connected_setter(True)
            self._log('mock_start', "[模擬] 虛擬硬體模擬已啟動", True)

            await self._broadcast_event('hardware_status', self._build_status())

            # 即刻傳送一筆初始數據
            initial_data = self._generate_sensor_data()
            await self._process_sensor(initial_data)

        except Exception as e:
            self._log('mock_error', f"[模擬錯誤] 無法啟動模擬任務：{e}", True)
            self.active = False
            hardware_connected_setter(False)
            await self._broadcast_event('error', {
                'message': f'模擬任務啟動失敗：{str(e)}',
                'type': 'MOCK_START_FAILED'
            })

    async def stop(
        self,
        hardware_connected_setter: Callable[[bool], None],
        physical_hardware_connected: bool
    ) -> None:
        """關閉硬體模擬任務。"""
        if self.mock_task:
            self.mock_task.cancel()
            try:
                await self.mock_task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                self._log('mock_cancel_error', f"[模擬] 取消任務時發生異常：{e}", True)
            self.mock_task = None

        try:
            self.active = False
            self.state.reset()
            await self._reset_state()

            # 根據是否有實體硬體連線，決定最終狀態
            if physical_hardware_connected:
                hardware_connected_setter(True)
                self._log('mock_stop_switch', "[模擬] 已關閉模擬模式 - 自動切換回實體硬體連線", True)
            else:
                hardware_connected_setter(False)
                self._log('mock_stop', "[模擬] 硬體模擬任務已結束", True)

            await self._broadcast_event('hardware_status', self._build_status())

        except Exception as e:
            self._log('mock_stop_error', f"[模擬錯誤] 結束任務時發生異常：{e}", True)

    async def _loop(self) -> None:
        """主模擬循環：定期定時產生感測器數據報文。"""
        self._log('mock_loop_start', "[模擬] ▶️ 感測器數據持續生成中...", True)

        loop_count = 0
        while True:
            try:
                loop_count += 1

                # 定期在主控台輸出狀態心跳
                if loop_count % 20 == 0:
                    self._log(
                        'mock_running',
                        f"[模擬] 📊 模擬器運作中 - 手機：{self.state.phone_inserted}, "
                        f"人員：{self.state.person_present}, 盒子：{self.state.box_open}",
                        False
                    )

                # 生成並處理模擬訊息
                mock_data = self._generate_sensor_data()
                await self._process_sensor(mock_data)
                await asyncio.sleep(settings.MOCK_INTERVAL_MS / 1000)

            except asyncio.CancelledError:
                self._log('mock_cancel', "[模擬] ⏹️ 數據生成已停止", True)
                break
            except Exception as e:
                self._log('mock_loop_error', f"[模擬錯誤] ❌ {e}", True)
                await asyncio.sleep(1)

    async def set_state(self, broadcast_state_callback: Callable, **kwargs) -> Dict[str, Any]:
        """動態更新模擬硬體的狀態，並廣播變更。"""
        try:
            state_changed = False
            for key, value in kwargs.items():
                if hasattr(self.state, key):
                    old_value = getattr(self.state, key)
                    if old_value != value:
                        setattr(self.state, key, value)
                        state_changed = True
                else:
                    self._log('mock_unknown_attr', f"[模擬] 警告：不支援的屬性名稱 '{key}'", False)

            if not state_changed:
                return self.state.to_dict()

            self._log(
                'mock_state_update',
                f"[模擬] 🔄 狀態更新：phone={self.state.phone_inserted}, "
                f"person={self.state.person_present}, box_open={self.state.box_open}",
                True
            )

            # 更新硬體摘要資訊
            await self._broadcast_event('hardware_status', self._build_status())

            # 若模擬器正在執行，立刻強制生成一筆新數據以加快反應速度
            if self.active:
                mock_data = self._generate_sensor_data()
                await self._process_sensor(mock_data)
                await broadcast_state_callback()

            return self.state.to_dict()

        except Exception as e:
            self._log('mock_set_error', f"[模擬錯誤] 更新狀態失敗：{e}", True)
            return self.state.to_dict()
