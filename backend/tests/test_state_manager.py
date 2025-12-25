"""
Tests for StateManager Module
=============================
Tests for system state management and sensor data processing.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock

from app.state_manager import StateManager
from app.models import (
    SystemState, SensorData, FocusSession, PenaltyConfig, SessionStatus,
    PhoneStatus, PresenceStatus, BoxStatus, NoiseStatus, HardwareState
)


class TestStateManagerInitialization:
    """Tests for StateManager initialization."""
    
    def test_default_initialization(self):
        """Verify default state manager initialization."""
        manager = StateManager(log_callback=MagicMock())
        
        assert manager.state is not None
        assert manager.hardware_connected is False
        assert manager.physical_hardware_ws_connected is False
        assert manager.hardware_firmware_version == "unknown"
    
    def test_initialization_with_state(self):
        """Test initialization with custom state."""
        custom_state = SystemState()
        custom_state.current_db = 60
        
        manager = StateManager(
            log_callback=MagicMock(),
            initial_state=custom_state
        )
        
        assert manager.state.current_db == 60


class TestStateSerialization:
    """Tests for state serialization."""
    
    @pytest.fixture
    def manager(self):
        """Create a StateManager instance."""
        return StateManager(log_callback=MagicMock())
    
    def test_serialize_basic_state(self, manager):
        """Test basic state serialization."""
        state_dict = manager.serialize_state()
        
        assert 'phone_status' in state_dict
        assert 'hardware_state' in state_dict
        assert state_dict['hardware_state'] == 'IDLE'
    
    def test_serialize_with_session(self, manager):
        """Test serialization with active session."""
        manager.state.session = FocusSession(
            id="test-123",
            duration_minutes=25,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE
        )
        
        state_dict = manager.serialize_state()
        
        assert state_dict['session'] is not None
        assert 'start_time' in state_dict['session']
        # Datetime should be ISO formatted string
        assert isinstance(state_dict['session']['start_time'], str)


class TestBroadcastThrottling:
    """Tests for broadcast throttling."""
    
    def test_first_broadcast_allowed(self):
        """First broadcast should always be allowed."""
        manager = StateManager(log_callback=MagicMock())
        assert manager.should_broadcast() is True
    
    def test_throttle_rapid_broadcasts(self):
        """Rapid broadcasts should be throttled."""
        manager = StateManager(log_callback=MagicMock())
        manager.broadcast_throttle_ms = 200
        
        manager.mark_broadcast()
        
        # Immediately after, should be throttled
        assert manager.should_broadcast() is False


class TestSensorDataProcessing:
    """Tests for sensor data processing."""
    
    @pytest.fixture
    def manager(self):
        """Create a StateManager instance."""
        return StateManager(log_callback=MagicMock())
    
    def test_process_basic_sensor_data(self, manager, mock_sensor_data):
        """Test processing basic sensor data."""
        result = manager.process_sensor_data(mock_sensor_data, mock_mode_active=False)
        
        assert result is not None
        assert manager.state.phone_status == PhoneStatus.LOCKED
        assert manager.state.presence_status == PresenceStatus.DETECTED
        assert manager.state.box_status == BoxStatus.CLOSED
    
    def test_phone_removed_detection(self, manager):
        """Test phone removal is detected."""
        data = {
            'nfc_id': None,
            'radar_presence': True,
            'mic_db': 40,
            'box_open': False,
            'timestamp': 1703241600000
        }
        
        manager.process_sensor_data(data, mock_mode_active=False)
        
        assert manager.state.phone_status == PhoneStatus.REMOVED
    
    def test_box_open_detection(self, manager):
        """Test box open is detected."""
        data = {
            'nfc_id': 'PHONE_001',
            'radar_presence': True,
            'mic_db': 40,
            'box_open': True,
            'timestamp': 1703241600000
        }
        
        manager.process_sensor_data(data, mock_mode_active=False)
        
        assert manager.state.box_status == BoxStatus.OPEN
    
    def test_person_away_tracking(self, manager):
        """Test person away timestamp is tracked."""
        # First, person detected
        data1 = {'nfc_id': 'PHONE', 'radar_presence': True, 'mic_db': 40, 'box_open': False}
        manager.process_sensor_data(data1, mock_mode_active=False)
        assert manager.state.person_away_since is None
        
        # Then, person leaves
        data2 = {'nfc_id': 'PHONE', 'radar_presence': False, 'mic_db': 40, 'box_open': False}
        manager.process_sensor_data(data2, mock_mode_active=False)
        assert manager.state.person_away_since is not None
    
    def test_mock_mode_phone_logic(self, manager):
        """Test mock mode doesn't tie phone status to box_open."""
        data = {
            'nfc_id': 'PHONE_001',
            'radar_presence': True,
            'mic_db': 40,
            'box_open': True,  # Box open in mock mode
            'timestamp': 1703241600000
        }
        
        manager.process_sensor_data(data, mock_mode_active=True)
        
        # In mock mode, phone should still be LOCKED despite box_open
        assert manager.state.phone_status == PhoneStatus.LOCKED
    
    def test_noise_detection(self, manager):
        """Test noise detection based on threshold."""
        manager.state.penalty_config.noise_threshold_db = 70
        
        # Below threshold
        data1 = {'nfc_id': 'PHONE', 'radar_presence': True, 'mic_db': 60, 'box_open': False}
        manager.process_sensor_data(data1, mock_mode_active=False)
        assert manager.state.noise_status == NoiseStatus.QUIET
        
        # Above threshold
        data2 = {'nfc_id': 'PHONE', 'radar_presence': True, 'mic_db': 85, 'box_open': False}
        manager.process_sensor_data(data2, mock_mode_active=False)
        assert manager.state.noise_status == NoiseStatus.NOISY


class TestSessionManagement:
    """Tests for session lifecycle management."""
    
    @pytest.fixture
    def manager(self):
        """Create a StateManager instance."""
        return StateManager(log_callback=MagicMock())
    
    def test_start_session(self, manager):
        """Test starting a focus session."""
        session = manager.start_session(duration_minutes=25)
        
        assert session is not None
        assert session.duration_minutes == 25
        assert session.status == SessionStatus.ACTIVE
        assert session.start_time is not None
        assert manager.state.session == session
    
    def test_stop_session(self, manager):
        """Test stopping a focus session."""
        manager.start_session(25)
        manager.stop_session()
        
        assert manager.state.session is None
    
    def test_pause_session(self, manager):
        """Test pausing a focus session."""
        manager.start_session(25)
        result = manager.pause_session()
        
        assert result is True
        assert manager.state.session.status == SessionStatus.PAUSED
        assert manager.state.session.paused_at is not None
    
    def test_pause_inactive_session_fails(self, manager):
        """Test pausing without active session fails."""
        result = manager.pause_session()
        assert result is False
    
    def test_resume_session(self, manager):
        """Test resuming a paused session."""
        manager.start_session(25)
        manager.pause_session()
        result = manager.resume_session()
        
        assert result is True
        assert manager.state.session.status == SessionStatus.ACTIVE
        assert manager.state.session.paused_at is None
    
    def test_resume_tracks_paused_time(self, manager):
        """Test resume tracks total paused time."""
        manager.start_session(25)
        manager.pause_session()
        
        # Simulate some time passing (modify paused_at directly for test)
        manager.state.session.total_paused_seconds = 0
        manager.resume_session()
        
        # After resume, total_paused_seconds should be updated
        assert manager.state.session.total_paused_seconds >= 0


class TestHardwareInfo:
    """Tests for hardware information tracking."""
    
    def test_update_hardware_info(self):
        """Test updating hardware connection info."""
        manager = StateManager(log_callback=MagicMock())
        
        manager.update_hardware_info(
            hardware_id="FOCUS-001",
            version="1.0.0",
            features="hall,lcd,radar",
            nfc_detected=True,
            ldr_detected=True,
            radar_detected=True
        )
        
        assert manager.hardware_connected is True
        assert manager.physical_hardware_ws_connected is True
        assert manager.hardware_firmware_version == "1.0.0"
        assert manager.hardware_features == "hall,lcd,radar"
        assert manager.physical_nfc_detected is True


class TestStateReset:
    """Tests for state reset functionality."""
    
    def test_reset_state(self):
        """Test state reset clears sensor statuses."""
        manager = StateManager(log_callback=MagicMock())
        
        # Set some state
        manager.state.phone_status = PhoneStatus.LOCKED
        manager.state.presence_status = PresenceStatus.DETECTED
        manager.state.current_db = 75
        
        manager.reset_state()
        
        assert manager.state.phone_status == PhoneStatus.UNKNOWN
        assert manager.state.presence_status == PresenceStatus.UNKNOWN
        assert manager.state.current_db == 40
