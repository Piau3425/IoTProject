"""
The Focus Enforcer Backend Application
Initializes Windows event loop policy for Playwright compatibility
"""
import sys
import asyncio

# CRITICAL: Set Windows event loop policy for Playwright
# This must run on every process import, including uvicorn reload subprocesses
if sys.platform == 'win32':
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass  # Already set or not needed
