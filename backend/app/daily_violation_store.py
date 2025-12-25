"""
今日違規次數儲存模組
==========================
記錄當日違規總次數，隔天自動歸零。
使用電腦原生時間判斷日期變更。
"""

import json
from pathlib import Path
from datetime import date
from typing import Optional

from .logger import safe_print


class DailyViolationStore:
    """每日違規次數管理器。
    
    職責：
    - 追蹤當日累計的違規次數
    - 隔天自動歸零（依據電腦本機時間）
    - 將數據持久化至 JSON 檔案
    """
    
    def __init__(self, data_dir: Optional[Path] = None) -> None:
        """初始化每日違規次數儲存器。
        
        Args:
            data_dir: 數據存放目錄，預設為 backend/data/
        """
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"
        
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_file = self.data_dir / "daily_violations.json"
        
        self._today_count: int = 0
        self._last_date: str = ""
        
        self._load()
    
    def _load(self) -> None:
        """從磁碟載入儲存的違規數據。"""
        if self.data_file.exists():
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._today_count = data.get('count', 0)
                    self._last_date = data.get('last_date', '')
                    safe_print(f"[每日違規] 載入數據：日期={self._last_date}, 次數={self._today_count}")
            except (json.JSONDecodeError, Exception) as e:
                safe_print(f"[每日違規] 載入失敗：{e}")
                self._today_count = 0
                self._last_date = ''
        else:
            # 首次使用，初始化為今日
            self._last_date = date.today().isoformat()
            self._save()
    
    def _save(self) -> None:
        """將違規數據保存至磁碟。"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'count': self._today_count,
                    'last_date': self._last_date
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            safe_print(f"[每日違規] 保存失敗：{e}")
    
    def _check_date_reset(self) -> bool:
        """檢查是否需要重置（隔天歸零）。
        
        Returns:
            bool: 是否觸發了日期重置
        """
        today = date.today().isoformat()
        if self._last_date != today:
            old_count = self._today_count
            self._today_count = 0
            self._last_date = today
            self._save()
            if old_count > 0:
                safe_print(f"[每日違規] 日期變更，違規次數已從 {old_count} 重置為 0")
            return True
        return False
    
    def increment(self) -> int:
        """增加一次違規並回傳當日新總數。
        
        Returns:
            int: 更新後的今日違規次數
        """
        self._check_date_reset()
        self._today_count += 1
        self._save()
        safe_print(f"[每日違規] 今日違規次數增加至 {self._today_count}")
        return self._today_count
    
    def get_count(self) -> int:
        """取得今日違規次數。
        
        Returns:
            int: 當日累計違規次數
        """
        self._check_date_reset()
        return self._today_count
    
    def get_date(self) -> str:
        """取得當前追蹤的日期。
        
        Returns:
            str: ISO 格式日期字串
        """
        self._check_date_reset()
        return self._last_date


# 建立全域單例實例供其他模組使用
daily_violation_store = DailyViolationStore()
