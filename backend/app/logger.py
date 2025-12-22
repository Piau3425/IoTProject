"""
Safe logging module for Focus Enforcer.
Handles broken pipe errors that occur when running in detached windows on Windows.
"""
import sys
import logging


def safe_print(*args, **kwargs):
    """Safe print that handles broken pipe errors on Windows."""
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, BrokenPipeError):
        # Stdout is broken (e.g., running in detached window), ignore
        pass


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger('focus_enforcer')


def log_info(message: str):
    """Log info message safely."""
    safe_print(message)


def log_error(message: str):
    """Log error message safely."""
    safe_print(f"[ERROR] {message}")


def log_debug(message: str):
    """Log debug message safely."""
    safe_print(f"[DEBUG] {message}")
