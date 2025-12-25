"""
懲罰模組
==========================
實作簡化的懲罰系統，違規即執行懲罰並停止會話。

此機制移除了分級懲罰邏輯，任何違規都會直接觸發懲罰並結束專注會話。
"""

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Callable, List
import asyncio

from .logger import safe_print
from .daily_violation_store import daily_violation_store


class PenaltyLevel(str, Enum):
    """懲罰狀態定義。"""
    NONE = "NONE"       # 無懲罰狀態
    PENALTY = "PENALTY" # 已執行懲罰


@dataclass
class ViolationState:
    """追蹤單次專注任務中的違規狀態。

    屬性：
        count: 當前任務中的總違規次數
        current_level: 目前懲罰狀態
        last_violation: 最後一次違規發生的時間點
        penalty_executed: 是否已執行懲罰
    """
    count: int = 0
    current_level: PenaltyLevel = PenaltyLevel.NONE
    last_violation: Optional[datetime] = None
    penalty_executed: bool = False

    def reset(self) -> None:
        """重置違規狀態（通常用於新任務開始時）。"""
        self.count = 0
        self.current_level = PenaltyLevel.NONE
        self.last_violation = None
        self.penalty_executed = False


class ProgressivePenaltyManager:
    """管理懲罰邏輯的核心類別。

    簡化版本：違規即懲罰，不分等級。

    使用範例：
        manager = ProgressivePenaltyManager()
        manager.on_penalty(handle_penalty)

        # 檢測到違規時：
        await manager.record_violation()
    """

    def __init__(self) -> None:
        """初始化懲罰管理器。"""
        self.state = ViolationState()
        self._penalty_callbacks: List[Callable] = []
        self._broadcast_callback: Optional[Callable] = None
        self._stop_session_callback: Optional[Callable] = None
        self._active = False

    def start_session(self) -> None:
        """為新任務啟動違規追蹤。"""
        self.state.reset()
        self._active = True
        safe_print("[懲罰系統] 懲罰機制已啟動")

    def stop_session(self) -> None:
        """停止當前任務的違規追蹤。"""
        self.state.reset()
        self._active = False
        safe_print("[懲罰系統] 懲罰機制已停止")

    def on_penalty(self, callback: Callable) -> None:
        """註冊懲罰執行回呼函式。

        Args:
            callback: 懲罰觸發時要執行的異步函式
        """
        self._penalty_callbacks.append(callback)

    def set_broadcast_callback(self, callback: Callable) -> None:
        """設定將懲罰狀態廣播至前端的回呼函式。"""
        self._broadcast_callback = callback

    def set_stop_session_callback(self, callback: Callable) -> None:
        """設定停止會話的回呼函式。"""
        self._stop_session_callback = callback

    async def record_violation(self, reason: str = "") -> PenaltyLevel:
        """記錄一次違規行為並執行懲罰。

        違規後直接執行懲罰並停止會話。

        Args:
            reason: 違規的原因描述

        Returns:
            此次記錄觸發的懲罰狀態
        """
        if not self._active:
            return PenaltyLevel.NONE

        # 如果已經執行過懲罰，不再重複執行
        if self.state.penalty_executed:
            safe_print(f"[懲罰系統] 懲罰已執行過，跳過本次違規: {reason}")
            return PenaltyLevel.PENALTY

        self.state.count += 1
        # 同步更新今日違規次數
        today_count = daily_violation_store.increment()
        self.state.last_violation = datetime.now()

        safe_print(f"[懲罰系統] 🚨 違規記錄 #{self.state.count} (今日累計: {today_count}): {reason}")

        # 直接執行懲罰
        await self._execute_penalty(reason)
        return PenaltyLevel.PENALTY

    async def violation_resolved(self) -> bool:
        """當違規狀態解除時呼叫此函式。
        
        簡化版本中，一旦違規已執行懲罰，無法撤銷。

        Returns:
            bool: 是否成功撤銷了懲罰（簡化版本始終返回 False）
        """
        # 簡化版本：違規後直接懲罰，無法撤銷
        return False

    async def _execute_penalty(self, reason: str) -> None:
        """執行懲罰邏輯。"""
        self.state.current_level = PenaltyLevel.PENALTY
        self.state.penalty_executed = True

        safe_print(f"[懲罰系統] 🚨 執行懲罰程序")

        # 執行所有懲罰回呼
        for callback in self._penalty_callbacks:
            try:
                await callback(PenaltyLevel.PENALTY, self.state.count, reason)
            except Exception as e:
                safe_print(f"[懲罰系統] 執行懲罰回呼時發生錯誤: {e}")

        # 廣播執行結果至前端
        if self._broadcast_callback:
            await self._broadcast_callback({
                'type': 'penalty_executed',
                'level': PenaltyLevel.PENALTY.value,
                'violation_count': self.state.count,
                'today_violation_count': daily_violation_store.get_count(),
                'reason': reason
            })

        # 執行懲罰後自動停止會話
        if self._stop_session_callback:
            safe_print("[懲罰系統] 懲罰完成，自動停止會話")
            await self._stop_session_callback()

    def get_state_dict(self) -> dict:
        """獲取當前懲罰狀態的字典格式，供 API 回傳使用。"""
        return {
            'active': self._active,
            'violation_count': self.state.count,
            'today_violation_count': daily_violation_store.get_count(),
            'current_level': self.state.current_level.value,
            'penalty_executed': self.state.penalty_executed
        }

    # 向後相容：保留舊的 API 但指向新的實作
    def on_penalty_level(self, level: PenaltyLevel, callback: Callable) -> None:
        """向後相容的懲罰等級註冊（已棄用，統一使用 on_penalty）。"""
        # 只有 PENALTY 等級會被執行
        if level == PenaltyLevel.PENALTY:
            self._penalty_callbacks.append(callback)


# 建立全域單一執行個體供其他模組使用
progressive_penalty = ProgressivePenaltyManager()
