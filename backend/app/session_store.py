"""
專注任務儲存模組
====================
負責持久化儲存專注任務的歷史紀錄，確保數據在伺服器重啟後依然存在。
使用 JSON 檔案作為輕量級的資料庫。
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class SessionRecord(BaseModel):
    """已完成專注任務的存檔紀錄模型。"""
    id: str
    start_time: str  # ISO 8601 格式字串
    end_time: str    # ISO 8601 格式字串
    duration_minutes: int
    status: str      # COMPLETED (完成), VIOLATED (違規), CANCELLED (取消)
    violation_count: int = 0
    penalty_level: Optional[str] = None
    total_focus_time_seconds: int = 0


class SessionStore:
    """歷史紀錄管理類別。

    封裝了對 JSON 檔案的所有讀寫操作，並提供統計與分頁功能。
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """初始化存儲空間。

        參數：
            data_dir: 數據存放目錄。預設為 backend/data/
        """
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"

        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.history_file = self.data_dir / "session_history.json"
        self.state_file = self.data_dir / "last_session_state.json"

        self._history: List[SessionRecord] = []
        self._load_history()

    def _load_history(self) -> None:
        """從磁碟載入所有歷史紀錄。"""
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._history = [SessionRecord(**record) for record in data]
            except (json.JSONDecodeError, Exception) as e:
                print(f"[SessionStore] 歷史紀錄載入失敗：{e}")
                self._history = []

    def _save_history(self) -> None:
        """將目前所有紀錄寫回磁碟。"""
        try:
            with open(self.history_file, 'w', encoding='utf-8') as f:
                data = [record.model_dump() for record in self._history]
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[SessionStore] 磁碟寫入失敗：{e}")

    def add_session(self, record: SessionRecord) -> None:
        """新增一筆已結束的任務紀錄。"""
        self._history.append(record)
        self._save_history()

    def get_history(
        self,
        limit: int = 50,
        offset: int = 0,
        status_filter: Optional[str] = None
    ) -> List[SessionRecord]:
        """取得歷史紀錄清單，支援分頁與過濾。

        參數：
            limit: 返回的最大筆數
            offset: 跳過的筆數
            status_filter: 可選的狀態過濾條件

        返回：
            排序後的紀錄清單（最新任務排在最前面）
        """
        filtered = self._history

        if status_filter:
            filtered = [r for r in filtered if r.status == status_filter]

        # 依據啟動時間進行降冪排序 (Newest first)
        sorted_history = sorted(
            filtered,
            key=lambda x: x.start_time,
            reverse=True
        )

        return sorted_history[offset:offset + limit]

    def get_statistics(self) -> Dict[str, Any]:
        """彙整歷史數據統計資訊。"""
        if not self._history:
            return {
                "total_sessions": 0,
                "completed_sessions": 0,
                "violated_sessions": 0,
                "completion_rate": 0.0,
                "total_focus_time_hours": 0.0,
                "average_session_minutes": 0.0
            }

        total = len(self._history)
        completed = sum(1 for r in self._history if r.status == "COMPLETED")
        violated = sum(1 for r in self._history if r.status == "VIOLATED")
        total_focus_seconds = sum(r.total_focus_time_seconds for r in self._history)

        return {
            "total_sessions": total,
            "completed_sessions": completed,
            "violated_sessions": violated,
            "completion_rate": round(completed / total * 100, 1) if total > 0 else 0.0,
            "total_focus_time_hours": round(total_focus_seconds / 3600, 2),
            "average_session_minutes": round(
                sum(r.duration_minutes for r in self._history) / total, 1
            ) if total > 0 else 0.0
        }

    def save_session_state(self, state: Dict[str, Any]) -> None:
        """發生意外中斷前，保存當前執行中的任務狀態以便後續恢復。"""
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            print(f"[SessionStore] 狀態存儲失敗：{e}")

    def load_session_state(self) -> Optional[Dict[str, Any]]:
        """載入上次保存的任務狀態（用於伺服器重啟後的恢復流程）。"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, Exception) as e:
                print(f"[SessionStore] 狀態載入失敗：{e}")
        return None

    def clear_session_state(self) -> None:
        """清除已恢復或不再需要的任務狀態檔案。"""
        if self.state_file.exists():
            try:
                self.state_file.unlink()
            except Exception as e:
                print(f"[SessionStore] 檔案刪除失敗：{e}")


# 單例模式實例
session_store = SessionStore()
