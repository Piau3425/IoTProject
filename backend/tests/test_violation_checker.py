"""
Tests for ViolationChecker Module
=================================
Tests for violation detection and penalty triggering logic.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.violation_checker import ViolationChecker
from app.models import (
    SystemState, FocusSession, PenaltyConfig, SessionStatus,
    PhoneStatus, PresenceStatus, BoxStatus, NoiseStatus
)


class TestViolationDetection:
    """Tests for violation detection logic."""
    
    @pytest.fixture
    def mock_log(self):
        """Create a mock log callback."""
        return MagicMock()
    
    @pytest.fixture
    def mock_broadcast(self):
        """Create a mock broadcast callback."""
        return AsyncMock()
    
    @pytest.fixture
    def checker(self, mock_log, mock_broadcast):
        """Create a ViolationChecker instance."""
        return ViolationChecker(
            log_callback=mock_log,
            broadcast_event_callback=mock_broadcast
        )
    
    @pytest.fixture
    def active_session(self):
        """Create an active focus session."""
        return FocusSession(
            id="test-session",
            duration_minutes=25,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE
        )
    
    @pytest.mark.asyncio
    async def test_no_violation_when_no_session(self, checker):
        """No violation should be detected without active session."""
        state = SystemState()
        state.phone_status = PhoneStatus.REMOVED  # Would be violation
        
        result = await checker.check_and_trigger(state)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_no_violation_when_session_paused(self, checker, active_session):
        """No violation when session is paused."""
        state = SystemState()
        state.session = active_session
        state.session.status = SessionStatus.PAUSED
        state.phone_status = PhoneStatus.REMOVED
        
        result = await checker.check_and_trigger(state)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_phone_removal_violation(self, checker, active_session, mock_broadcast):
        """Phone removal should trigger violation."""
        state = SystemState()
        state.session = active_session
        state.phone_status = PhoneStatus.REMOVED
        
        result = await checker.check_and_trigger(state)
        
        assert result is True
        assert state.session.violations == 1
        assert state.session.status == SessionStatus.VIOLATED
        mock_broadcast.assert_called()
    
    @pytest.mark.asyncio
    async def test_box_open_violation(self, checker, active_session, mock_broadcast):
        """Box open should trigger violation if enabled."""
        state = SystemState()
        state.session = active_session
        state.box_status = BoxStatus.OPEN
        
        result = await checker.check_and_trigger(state)
        
        assert result is True
        assert state.session.violations == 1
    
    @pytest.mark.asyncio
    async def test_penalty_disabled_no_violation(self, checker, active_session):
        """No violation when penalty is disabled for that sensor."""
        state = SystemState()
        state.session = active_session
        state.session.penalty_config = PenaltyConfig(
            enable_phone_penalty=False,
            enable_presence_penalty=False,
            enable_box_open_penalty=False
        )
        state.phone_status = PhoneStatus.REMOVED
        state.box_status = BoxStatus.OPEN
        
        result = await checker.check_and_trigger(state)
        
        assert result is False
        assert state.session.violations == 0
    
    @pytest.mark.asyncio
    async def test_noise_violation_above_threshold(self, checker, active_session):
        """Noise above threshold should trigger violation if enabled."""
        state = SystemState()
        state.session = active_session
        state.session.penalty_config = PenaltyConfig(
            enable_noise_penalty=True,
            noise_threshold_db=70
        )
        state.noise_status = NoiseStatus.NOISY
        state.current_db = 85
        
        result = await checker.check_and_trigger(state)
        
        assert result is True


class TestPenaltyCooldown:
    """Tests for penalty cooldown mechanism."""
    
    @pytest.fixture
    def checker(self):
        """Create a ViolationChecker with short cooldown."""
        return ViolationChecker(
            log_callback=MagicMock(),
            broadcast_event_callback=AsyncMock(),
            penalty_cooldown_seconds=5
        )
    
    @pytest.mark.asyncio
    async def test_cooldown_prevents_spam(self, checker):
        """Penalty should not trigger during cooldown."""
        state = SystemState()
        state.session = FocusSession(
            id="test",
            duration_minutes=25,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE
        )
        state.phone_status = PhoneStatus.REMOVED
        
        # First violation should trigger
        result1 = await checker.check_and_trigger(state)
        assert result1 is True
        
        # Reset session status for next check
        state.session.status = SessionStatus.ACTIVE
        
        # Second violation should be blocked by cooldown
        result2 = await checker.check_and_trigger(state)
        assert result2 is False
    
    def test_reset_penalty_timer(self, checker):
        """Reset timer should allow immediate penalty."""
        checker.last_penalty_time = datetime.now()
        checker.reset_penalty_timer()
        assert checker.last_penalty_time is None


class TestHostageManagement:
    """Tests for hostage path management."""
    
    def test_set_hostage_path(self):
        """Test setting hostage path."""
        checker = ViolationChecker(
            log_callback=MagicMock(),
            broadcast_event_callback=AsyncMock()
        )
        
        checker.set_hostage_path("/path/to/image.jpg")
        assert checker.current_hostage_path == "/path/to/image.jpg"
        
        checker.set_hostage_path(None)
        assert checker.current_hostage_path is None


class TestPenaltyCallbacks:
    """Tests for penalty callback registration and execution."""
    
    @pytest.mark.asyncio
    async def test_register_and_execute_callback(self):
        """Test callback is registered and executed on penalty."""
        callback_executed = False
        
        async def my_callback(state, hostage_path):
            nonlocal callback_executed
            callback_executed = True
        
        checker = ViolationChecker(
            log_callback=MagicMock(),
            broadcast_event_callback=AsyncMock()
        )
        checker.register_callback(my_callback)
        
        state = SystemState()
        state.session = FocusSession(
            id="test",
            duration_minutes=25,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE
        )
        state.phone_status = PhoneStatus.REMOVED
        
        await checker.check_and_trigger(state)
        
        assert callback_executed is True
