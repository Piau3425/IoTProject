"""
Pytest Configuration and Fixtures
==================================
Provides shared fixtures for testing Focus Enforcer backend.
"""

import asyncio
import pytest
from typing import Generator, AsyncGenerator
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_sensor_data() -> dict:
    """Provide sample sensor data for testing."""
    return {
        'nfc_id': 'PHONE_TEST_001',
        'gyro_x': 0.0,
        'gyro_y': 0.0,
        'gyro_z': 0.0,
        'radar_presence': True,
        'mic_db': 45,
        'box_locked': True,
        'box_open': False,
        'timestamp': 1703241600000,
        'nfc_detected': True,
        'ldr_detected': True
    }


@pytest.fixture
def violation_sensor_data() -> dict:
    """Provide sensor data that should trigger violations."""
    return {
        'nfc_id': None,  # Phone removed
        'gyro_x': 0.0,
        'gyro_y': 0.0,
        'gyro_z': 0.0,
        'radar_presence': False,  # Person away
        'mic_db': 85,  # Noisy
        'box_locked': False,
        'box_open': True,  # Box opened
        'timestamp': 1703241600000,
        'nfc_detected': True,
        'ldr_detected': True
    }


@pytest.fixture
def penalty_config() -> dict:
    """Provide sample penalty configuration."""
    return {
        'enable_phone_penalty': True,
        'enable_presence_penalty': True,
        'enable_noise_penalty': False,
        'enable_box_open_penalty': True,
        'noise_threshold_db': 70
    }
