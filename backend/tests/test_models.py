"""
Tests for Pydantic Models
=========================
Tests for data model serialization, validation, and enum handling.
"""

import pytest
from datetime import datetime

from app.models import (
    SensorData, SystemState, FocusSession, PenaltyConfig, PenaltySettings,
    PhoneStatus, PresenceStatus, BoxStatus, NoiseStatus, SessionStatus,
    HardwareState
)


class TestEnums:
    """Test enum definitions and values."""
    
    def test_phone_status_values(self):
        """Verify PhoneStatus enum values."""
        assert PhoneStatus.LOCKED.value == "LOCKED"
        assert PhoneStatus.REMOVED.value == "REMOVED"
        assert PhoneStatus.UNKNOWN.value == "UNKNOWN"
    
    def test_presence_status_values(self):
        """Verify PresenceStatus enum values."""
        assert PresenceStatus.DETECTED.value == "DETECTED"
        assert PresenceStatus.AWAY.value == "AWAY"
        assert PresenceStatus.UNKNOWN.value == "UNKNOWN"
    
    def test_box_status_values(self):
        """Verify BoxStatus enum values."""
        assert BoxStatus.CLOSED.value == "CLOSED"
        assert BoxStatus.OPEN.value == "OPEN"
        assert BoxStatus.UNKNOWN.value == "UNKNOWN"
    
    def test_hardware_state_values(self):
        """Verify HardwareState enum values match firmware."""
        expected = ['IDLE', 'PREPARING', 'FOCUSING', 'PAUSED', 'VIOLATION', 'ERROR']
        actual = [s.value for s in HardwareState]
        assert actual == expected


class TestSensorData:
    """Tests for SensorData model."""
    
    def test_default_values(self):
        """Verify default sensor data values."""
        sensor = SensorData()
        assert sensor.box_open is False
        assert sensor.radar_presence is False
        assert sensor.mic_db == 40
        assert sensor.nfc_id is None
    
    def test_parse_from_dict(self, mock_sensor_data):
        """Test parsing sensor data from dictionary."""
        sensor = SensorData(**mock_sensor_data)
        assert sensor.nfc_id == 'PHONE_TEST_001'
        assert sensor.radar_presence is True
        assert sensor.box_open is False
        assert sensor.mic_db == 45
    
    def test_box_locked_legacy_compatibility(self):
        """Test legacy box_locked field works with box_open."""
        sensor = SensorData(box_locked=False)
        assert sensor.box_locked is False


class TestPenaltyConfig:
    """Tests for PenaltyConfig model."""
    
    def test_default_values(self):
        """Verify default penalty configuration."""
        config = PenaltyConfig()
        assert config.enable_phone_penalty is True
        assert config.enable_presence_penalty is True
        assert config.enable_noise_penalty is False  # Default off for cafes
        assert config.enable_box_open_penalty is True
        assert config.noise_threshold_db == 70
    
    def test_parse_from_dict(self, penalty_config):
        """Test parsing config from dictionary."""
        config = PenaltyConfig(**penalty_config)
        assert config.enable_phone_penalty is True
        assert config.enable_noise_penalty is False
    
    def test_custom_threshold(self):
        """Test custom noise threshold."""
        config = PenaltyConfig(noise_threshold_db=85)
        assert config.noise_threshold_db == 85


class TestFocusSession:
    """Tests for FocusSession model."""
    
    def test_new_session_defaults(self):
        """Verify new session has correct defaults."""
        session = FocusSession(id="test-123", duration_minutes=25)
        assert session.id == "test-123"
        assert session.duration_minutes == 25
        assert session.status == SessionStatus.IDLE
        assert session.violations == 0
        assert session.penalties_executed == 0
        assert session.total_paused_seconds == 0
    
    def test_session_with_times(self):
        """Test session with start/end times."""
        now = datetime.now()
        session = FocusSession(
            id="test-456",
            duration_minutes=30,
            start_time=now,
            status=SessionStatus.ACTIVE
        )
        assert session.start_time == now
        assert session.end_time is None


class TestSystemState:
    """Tests for SystemState model."""
    
    def test_default_state(self):
        """Verify default system state."""
        state = SystemState()
        assert state.session is None
        assert state.phone_status == PhoneStatus.UNKNOWN
        assert state.presence_status == PresenceStatus.UNKNOWN
        assert state.box_status == BoxStatus.UNKNOWN
        assert state.hardware_state == HardwareState.IDLE
        assert state.current_db == 40
    
    def test_state_serialization(self):
        """Test state can be serialized to dictionary."""
        state = SystemState()
        state_dict = state.model_dump()
        assert 'phone_status' in state_dict
        assert 'hardware_state' in state_dict
        assert 'penalty_config' in state_dict
