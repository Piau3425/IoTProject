"""
Startup script for The Focus Enforcer backend
Sets Windows event loop policy before starting uvicorn
"""
import sys
import asyncio
import os

# Safe print function for startup
def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, BrokenPipeError):
        pass

# CRITICAL: Set event loop policy BEFORE any async operations
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    # Also set environment variable so child processes inherit this
    os.environ['PYTHONASYNCIODEBUG'] = '0'

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    
    safe_print("=" * 65)
    safe_print(f"Starting {settings.APP_NAME}")
    safe_print(f"Host: {settings.HOST}:{settings.PORT}")
    safe_print(f"Debug Mode: {settings.DEBUG}")
    safe_print(f"Mock Hardware: {settings.MOCK_HARDWARE}")
    safe_print("=" * 65)
    
    # Use --reload-dir to avoid watching unnecessary files
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_dirs=["./app"] if settings.DEBUG else None,
        loop="asyncio",
        # Use single process mode to avoid subprocess issues
        workers=1,
        # Log configuration
        log_level="info" if not settings.DEBUG else "debug",
        access_log=True
    )
