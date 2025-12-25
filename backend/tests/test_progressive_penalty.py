"""
Tests for Progressive Penalty Module
=====================================
Tests for the graduated penalty system.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from app.progressive_penalty import (
    ProgressivePenaltyManager,
    PenaltyLevel,
    ViolationState
)


class TestViolationState:
    """Tests for ViolationState dataclass."""
    
    def test_initial_state(self):
        """Test initial state values."""
        state = ViolationState()
        assert state.count == 0
        assert state.current_level == PenaltyLevel.NONE
        assert state.last_violation is None
        assert state.pending_penalty is False
        assert state.grace_period_task is None
        assert state.levels_executed == []
    
    def test_reset(self):
        """Test state reset."""
        state = ViolationState()
        state.count = 5
        state.current_level = PenaltyLevel.RED
        state.pending_penalty = True
        state.levels_executed = [PenaltyLevel.BLUE, PenaltyLevel.YELLOW]
        
        state.reset()
        
        assert state.count == 0
        assert state.current_level == PenaltyLevel.NONE
        assert state.pending_penalty is False
        assert state.levels_executed == []


class TestProgressivePenaltyManager:
    """Tests for ProgressivePenaltyManager class."""
    
    def test_initialization(self):
        """Test manager initialization."""
        manager = ProgressivePenaltyManager()
        assert manager._active is False
        assert manager.state.count == 0
    
    def test_start_session(self):
        """Test session start."""
        manager = ProgressivePenaltyManager()
        manager.start_session()
        assert manager._active is True
    
    def test_stop_session(self):
        """Test session stop."""
        manager = ProgressivePenaltyManager()
        manager.start_session()
        manager.stop_session()
        assert manager._active is False
        assert manager.state.count == 0
    
    def test_determine_level(self):
        """Test penalty level determination based on violation count."""
        manager = ProgressivePenaltyManager()
        
        assert manager._determine_level(0) == PenaltyLevel.NONE
        assert manager._determine_level(1) == PenaltyLevel.BLUE
        assert manager._determine_level(2) == PenaltyLevel.YELLOW
        assert manager._determine_level(3) == PenaltyLevel.RED
        assert manager._determine_level(4) == PenaltyLevel.RED
        assert manager._determine_level(5) == PenaltyLevel.CRITICAL
        assert manager._determine_level(10) == PenaltyLevel.CRITICAL
    
    @pytest.mark.asyncio
    async def test_record_violation_when_inactive(self):
        """Test violation recording when manager is inactive."""
        manager = ProgressivePenaltyManager()
        
        result = await manager.record_violation("test")
        
        assert result == PenaltyLevel.NONE
        assert manager.state.count == 0
    
    @pytest.mark.asyncio
    async def test_first_violation_starts_grace_period(self):
        """Test that first violation starts grace period."""
        manager = ProgressivePenaltyManager()
        manager.GRACE_PERIOD_SECONDS = 0.1  # Short timeout for testing
        manager.start_session()
        
        result = await manager.record_violation("phone removed")
        
        assert result == PenaltyLevel.BLUE
        assert manager.state.count == 1
        assert manager.state.pending_penalty is True
        assert manager.state.current_level == PenaltyLevel.BLUE
        
        # Clean up
        manager.stop_session()
    
    @pytest.mark.asyncio
    async def test_violation_resolved_during_grace_period(self):
        """Test violation resolution during grace period."""
        manager = ProgressivePenaltyManager()
        manager.GRACE_PERIOD_SECONDS = 5  # Long enough to resolve
        manager.start_session()
        
        await manager.record_violation("phone removed")
        assert manager.state.pending_penalty is True
        
        result = await manager.violation_resolved()
        
        assert result is True
        assert manager.state.pending_penalty is False
        assert manager.state.count == 0  # Count reduced
        
        manager.stop_session()
    
    @pytest.mark.asyncio
    async def test_second_violation_escalates(self):
        """Test that second violation escalates to yellow level."""
        manager = ProgressivePenaltyManager()
        manager.GRACE_PERIOD_SECONDS = 0.01
        manager.start_session()
        
        await manager.record_violation("first")
        await asyncio.sleep(0.02)  # Wait for grace period
        
        result = await manager.record_violation("second")
        
        assert result == PenaltyLevel.YELLOW
        assert manager.state.count == 2
        
        manager.stop_session()
    
    @pytest.mark.asyncio
    async def test_callback_registration(self):
        """Test callback registration and execution."""
        manager = ProgressivePenaltyManager()
        manager.GRACE_PERIOD_SECONDS = 0.01
        
        callback_called = []
        
        async def test_callback(level, count, reason):
            callback_called.append((level, count, reason))
        
        manager.on_penalty_level(PenaltyLevel.BLUE, test_callback)
        manager.start_session()
        
        await manager.record_violation("test reason")
        
        assert len(callback_called) == 1
        assert callback_called[0][0] == PenaltyLevel.BLUE
        assert callback_called[0][1] == 1
        assert callback_called[0][2] == "test reason"
        
        manager.stop_session()
    
    @pytest.mark.asyncio
    async def test_broadcast_callback(self):
        """Test broadcast callback for frontend updates."""
        manager = ProgressivePenaltyManager()
        manager.GRACE_PERIOD_SECONDS = 0.01
        
        broadcasts = []
        
        async def broadcast(data):
            broadcasts.append(data)
        
        manager.set_broadcast_callback(broadcast)
        manager.start_session()
        
        await manager.record_violation("test")
        
        assert len(broadcasts) == 1
        assert broadcasts[0]['type'] == 'penalty_warning'
        assert broadcasts[0]['level'] == 'BLUE'
        
        manager.stop_session()
    
    def test_get_state_dict(self):
        """Test state dictionary generation."""
        manager = ProgressivePenaltyManager()
        manager.start_session()
        
        state = manager.get_state_dict()
        
        assert state['active'] is True
        assert state['violation_count'] == 0
        assert state['current_level'] == 'NONE'
        assert state['pending_penalty'] is False
        assert state['levels_executed'] == []
        
        manager.stop_session()


class TestPenaltyLevel:
    """Tests for PenaltyLevel enum."""
    
    def test_levels_exist(self):
        """Test all expected levels exist."""
        assert PenaltyLevel.NONE.value == "NONE"
        assert PenaltyLevel.BLUE.value == "BLUE"
        assert PenaltyLevel.YELLOW.value == "YELLOW"
        assert PenaltyLevel.RED.value == "RED"
        assert PenaltyLevel.CRITICAL.value == "CRITICAL"
