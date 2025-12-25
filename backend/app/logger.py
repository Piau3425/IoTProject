"""
日誌記錄模組
====================
提供安全、穩定的日誌輸出功能。
特別針對 Windows 環境下的 Broken Pipe 錯誤進行處理，確保在後台運行時不會當機。
"""
import sys
import logging


def safe_print(*args, **kwargs):
    """安全的輸出函式，能自動處理 Windows 上的 Broken Pipe 異常。"""
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, BrokenPipeError):
        # 當標準輸出失效時（例如視窗已關閉但程式仍在運行），直接忽略錯誤
        pass


# 配置基礎日誌格式
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger('focus_enforcer')


def log_info(message: str):
    """輸出一般資訊。"""
    safe_print(message)


def log_error(message: str):
    """輸出錯誤訊息。"""
    safe_print(f"[錯誤] {message}")


def log_debug(message: str):
    """輸出偵錯訊息。"""
    safe_print(f"[偵錯] {message}")
