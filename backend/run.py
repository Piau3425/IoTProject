"""
Focus Enforcer 後端啟動腳本。
在啟動 Uvicorn 之前，針對 Windows 環境設定適當的事件迴圈策略（Event Loop Policy）。
"""
import sys
import asyncio
import os

# 啟動時的安全列印函數，防止 Windows 上的 Broken Pipe 錯誤
def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, BrokenPipeError):
        pass

# 關鍵設定：在任何非同步操作開始前，必須先設定 Windows 的事件迴圈策略
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    # 關閉偵錯模式以提升效能
    os.environ['PYTHONASYNCIODEBUG'] = '0'

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    
    safe_print("=" * 65)
    safe_print(f"正在啟動 {settings.APP_NAME}")
    safe_print(f"位址: {settings.HOST}:{settings.PORT}")
    safe_print(f"偵錯模式: {settings.DEBUG}")
    safe_print(f"硬體模擬: {settings.MOCK_HARDWARE}")
    safe_print("=" * 65)
    
    # 執行伺服器作業
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        # 僅監視 app 目錄以減少無效載入
        reload_dirs=["./app"] if settings.DEBUG else None,
        loop="asyncio",
        # 使用單一進程模式以避免 Windows 子進程開銷與報錯
        workers=1,
        # 根據偵錯模式調整日誌層級
        log_level="info" if not settings.DEBUG else "debug",
        access_log=True
    )
