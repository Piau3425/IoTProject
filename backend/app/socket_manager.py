import asyncio
import random
from datetime import datetime
from typing import Optional, Callable, List
import socketio

from .config import settings
from .models import (
    SensorData, SystemState, PhoneStatus, PresenceStatus, BoxStatus, 
    NoiseStatus, SessionStatus, PenaltySettings, PenaltyConfig, FocusSession,
    HardwareState
)


class MockHardwareState:
    """Persistent state for mock hardware simulation."""
    def __init__(self):
        self.phone_inserted: bool = True
        self.person_present: bool = True
        self.nfc_valid: bool = True
        self.box_locked: bool = True
        self.box_open: bool = False  # Hall sensor - box open state
        self.manual_mode: bool = False
    
    def to_dict(self) -> dict:
        return {
            'phone_inserted': self.phone_inserted,
            'person_present': self.person_present,
            'nfc_valid': self.nfc_valid,
            'box_locked': self.box_locked,
            'box_open': self.box_open,
            'manual_mode': self.manual_mode
        }


class SocketManager:
    def __init__(self):
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            logger=False,
            engineio_logger=False
        )
        self.app = socketio.ASGIApp(self.sio)
        
        self.state = SystemState()
        self.connected_clients: List[str] = []
        self.hardware_connected: bool = False
        self.mock_mode_active: bool = False
        self.mock_task: Optional[asyncio.Task] = None
        self.mock_state: MockHardwareState = MockHardwareState()
        self.penalty_callbacks: List[Callable] = []
        self.current_hostage_path: Optional[str] = None
        self.last_penalty_time: Optional[datetime] = None
        self.penalty_cooldown_seconds: int = 30
        self.last_broadcast_time: Optional[datetime] = None
        self.broadcast_throttle_ms: int = 200
        
        # Physical hardware sensor detection status
        self.physical_nfc_detected: bool = False
        self.physical_ldr_detected: bool = False
        self.physical_radar_detected: bool = True  # v1.0: radar always present
        
        # v1.0: Hardware state tracking
        self.hardware_firmware_version: str = "unknown"
        self.hardware_features: str = ""
        
        # Logging throttle
        self.last_log_time: dict[str, datetime] = {}
        self.log_throttle_seconds: float = 5.0
        
        self._setup_handlers()
    
    def _setup_handlers(self):
        @self.sio.event
        async def connect(sid, environ):
            self.connected_clients.append(sid)
            self._throttled_log('client_connect', f"[WS] Client connected: {sid}", force=True)
            await self.sio.emit('system_state', self._serialize_state(), room=sid)
            nfc_detected, ldr_detected, radar_detected = self.get_sensor_detection_status()
            
            await self.sio.emit('hardware_status', {
                'connected': self.hardware_connected,
                'mock_mode': self.mock_mode_active,
                'mock_state': self.mock_state.to_dict(),
                'nfc_detected': nfc_detected,
                'ldr_detected': ldr_detected,
                'hall_detected': ldr_detected,  # v1.0: Hall sensor maps to ldr_detected
                'radar_detected': radar_detected,
                'lcd_detected': False,  # Will be updated when hardware connects
                'hardware_state': self.state.hardware_state.value,
                'firmware_version': self.hardware_firmware_version
            }, room=sid)
        
        @self.sio.event
        async def disconnect(sid):
            if sid in self.connected_clients:
                self.connected_clients.remove(sid)
            self._throttled_log('client_disconnect', f"[WS] Client disconnected: {sid}", force=True)
        
        @self.sio.event
        async def hardware_connect(sid, data):
            """Handle physical hardware connection (v1.0 format)."""
            hardware_id = data.get('hardware_id', 'UNKNOWN')
            version = data.get('version', 'N/A')
            board = data.get('board', 'D1-mini')
            features = data.get('features', '')  # v1.0: "hall,lcd,radar"
            
            # v1.0: Hall sensor replaces LDR
            hall_detected = 'hall' in features or data.get('hall_detected', True)
            radar_detected = 'radar' in features or data.get('radar_detected', True)
            lcd_detected = 'lcd' in features
            
            # Legacy compatibility
            nfc_detected = data.get('nfc_detected', False)
            ldr_detected = data.get('ldr_detected', hall_detected)  # Map hall to ldr for frontend
            
            if self.mock_mode_active:
                self._throttled_log('hw_ignored', f"[HARDWARE] Ignoring physical hardware (Mock mode is active)", force=False)
                return
            
            self._throttled_log('hw_connect', f"[HARDWARE] v1.0 Connected - ID: {hardware_id}, Version: {version}, Board: {board}", force=True)
            self._throttled_log('hw_features', f"[HARDWARE] Features: {features}", force=True)
            
            self.hardware_connected = True
            self.hardware_firmware_version = version
            self.hardware_features = features
            self.physical_nfc_detected = nfc_detected
            self.physical_ldr_detected = hall_detected  # Hall sensor maps to ldr_detected
            self.physical_radar_detected = radar_detected
            
            await self.broadcast_event('hardware_status', {
                'connected': True, 
                'mock_mode': False,
                'hardware_id': hardware_id,
                'version': version,
                'board': board,
                'features': features,
                'nfc_detected': nfc_detected,
                'ldr_detected': hall_detected,
                'hall_detected': hall_detected,  # v1.0: Explicit hall sensor field
                'radar_detected': radar_detected,
                'lcd_detected': lcd_detected,
                'mock_state': self.mock_state.to_dict()
            })
        
        @self.sio.event
        async def heartbeat(sid, data):
            """Handle heartbeat from physical hardware (v1.0 format)."""
            hardware_id = data.get('hardware_id', 'UNKNOWN')
            state = data.get('state', 'IDLE')  # v1.0: hardware state machine
            uptime = data.get('uptime', 0)
            wifi_rssi = data.get('wifi_rssi', 0)
            free_heap = data.get('free_heap', 0)
        
        @self.sio.event
        async def state_change(sid, data):
            """Handle hardware state machine changes (v1.0 new event)."""
            hardware_id = data.get('hardware_id', 'UNKNOWN')
            previous_state = data.get('previous_state', 'IDLE')
            current_state = data.get('current_state', 'IDLE')
            total_focus_time_ms = data.get('total_focus_time_ms', 0)
            
            self._throttled_log('state_change', f"[HARDWARE STATE] {previous_state} → {current_state}", force=True)
            
            # Update system state
            try:
                self.state.hardware_state = HardwareState(current_state)
            except ValueError:
                self.state.hardware_state = HardwareState.IDLE
            
            # Handle state transitions
            if current_state == 'VIOLATION':
                # Hardware detected violation (box opened during focus)
                if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
                    self._throttled_log('hw_violation', "[HARDWARE] Violation detected by hardware!", force=True)
                    self.state.box_status = BoxStatus.OPEN
                    await self._check_violations()
            
            elif current_state == 'FOCUSING':
                # Hardware entered focus mode
                self.state.box_status = BoxStatus.CLOSED
            
            elif current_state == 'IDLE':
                # Hardware returned to idle
                pass
            
            await self.broadcast_state(force=True)
            await self.broadcast_event('hardware_state_change', {
                'previous_state': previous_state,
                'current_state': current_state,
                'total_focus_time_ms': total_focus_time_ms
            })
        
        @self.sio.event
        async def sensor_data(sid, data):
            if self.mock_mode_active:
                return
            
            # v1.0: Extract new fields
            nfc_detected = data.get('nfc_detected', False)
            ldr_detected = data.get('ldr_detected', False)  # Actually hall sensor in v1.0
            if ldr_detected is not None:
                data['ldr_detected'] = ldr_detected
            
            # Don't log routine sensor data - happens 10 times per second
            # Only important state changes are logged in process_sensor_data
                
            await self.process_sensor_data(data)
        
        @self.sio.event
        async def start_session(sid, data):
            duration = data.get('duration_minutes', 25)
            await self.start_focus_session(duration)
        
        @self.sio.event
        async def stop_session(sid, data):
            await self.stop_focus_session()
        
        @self.sio.event
        async def update_penalty_settings(sid, data):
            try:
                self.state.penalty_settings = PenaltySettings(**data)
                await self.broadcast_state(force=True)
            except Exception as e:
                print(f"[ERROR] Failed to update penalty settings: {e}")
        
        @self.sio.event
        async def update_penalty_config(sid, data):
            """Update granular penalty configuration."""
            try:
                self.state.penalty_config = PenaltyConfig(**data)
                # Also update active session's penalty config if session exists
                if self.state.session:
                    self.state.session.penalty_config = self.state.penalty_config
                print(f"[PENALTY CONFIG] Updated: {self.state.penalty_config.model_dump()}")
                await self.broadcast_state(force=True)
            except Exception as e:
                print(f"[ERROR] Failed to update penalty config: {e}")
        
        @self.sio.event
        async def toggle_mock_hardware(sid, data):
            enabled = data.get('enabled', False)
            print(f"[MOCK] Toggle request: enabled={enabled}, current_state={self.mock_mode_active}")
            if enabled:
                await self.start_mock_hardware()
            else:
                await self.stop_mock_hardware()
    
    async def process_sensor_data(self, data: dict):
        try:
            # Normalize nfc_id: convert empty string to None
            if 'nfc_id' in data and data['nfc_id'] == '':
                data['nfc_id'] = None
            
            # Handle box_open field (v1.0: Hall sensor, v2.0: LDR)
            if 'box_open' not in data:
                # Legacy compatibility: infer from box_locked
                data['box_open'] = not data.get('box_locked', True)
            
            sensor = SensorData(**data)
            self.state.last_sensor_data = sensor
            self.state.current_db = sensor.mic_db
            
            # v1.0: Update hardware state from sensor data
            if sensor.state:
                try:
                    self.state.hardware_state = HardwareState(sensor.state)
                except ValueError:
                    pass
            
            # Update phone status based on NFC (legacy, v1.0 doesn't use NFC)
            if sensor.nfc_id and not sensor.box_open:
                if self.state.phone_status != PhoneStatus.LOCKED:
                    self._throttled_log('phone_locked', "[STATUS] ✓ Phone locked in box", force=True)
                self.state.phone_status = PhoneStatus.LOCKED
            elif not sensor.nfc_id or sensor.box_open:
                if self.state.phone_status == PhoneStatus.LOCKED:
                    self.state.phone_status = PhoneStatus.REMOVED
                    self._throttled_log('phone_removed', "[ALERT] ⚠️  Phone removed from box!", force=True)
                else:
                    self.state.phone_status = PhoneStatus.REMOVED
            
            # Update presence status based on radar
            if sensor.radar_presence:
                if self.state.presence_status != PresenceStatus.DETECTED:
                    self._throttled_log('person_detected', "[STATUS] ✓ Person detected", force=True)
                self.state.presence_status = PresenceStatus.DETECTED
                self.state.person_away_since = None
            else:
                if self.state.presence_status == PresenceStatus.DETECTED:
                    self.state.person_away_since = datetime.now()
                    self._throttled_log('person_away', "[STATUS] ⚠️  Person away - monitoring...", force=True)
                self.state.presence_status = PresenceStatus.AWAY
            
            # Update box status based on LDR (new in v2.0)
            if sensor.box_open:
                if self.state.box_status != BoxStatus.OPEN:
                    self._throttled_log('box_open', "[ALERT] ⚠️  Box opened!", force=True)
                self.state.box_status = BoxStatus.OPEN
            else:
                if self.state.box_status != BoxStatus.CLOSED:
                    self._throttled_log('box_closed', "[STATUS] ✓ Box closed", force=True)
                self.state.box_status = BoxStatus.CLOSED
            
            # Update noise status based on mic
            noise_threshold = self.state.penalty_config.noise_threshold_db
            if sensor.mic_db >= noise_threshold:
                if self.state.noise_status != NoiseStatus.NOISY:
                    self._throttled_log('noise_detected', f"[ALERT] ⚠️  Noise detected ({sensor.mic_db} dB)", force=True)
                self.state.noise_status = NoiseStatus.NOISY
            else:
                self.state.noise_status = NoiseStatus.QUIET
            
            # Check for violations during active session
            await self._check_violations()
            
            # Broadcast updated state to all clients
            await self.broadcast_state()
            
        except Exception as e:
            import traceback
            print(f"[ERROR] Processing sensor data: {e}")
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            print(f"[ERROR] Data received: {data}")
    
    async def _check_violations(self):
        if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
            violation_detected = False
            violation_reason = ""
            
            # Get penalty config from session (which inherits from global if not overridden)
            config = self.state.session.penalty_config
            
            # Check if phone was removed (only if penalty enabled)
            if config.enable_phone_penalty and self.state.phone_status == PhoneStatus.REMOVED:
                violation_detected = True
                violation_reason = "Phone removed"
                self._throttled_log('violation_phone', "[VIOLATION] ⚠️  Phone removed during focus session!")
            
            # Check if person has been away too long (only if penalty enabled)
            if config.enable_presence_penalty and self.state.person_away_since:
                away_duration = (datetime.now() - self.state.person_away_since).total_seconds()
                if away_duration > settings.PERSON_AWAY_THRESHOLD_SEC:
                    violation_detected = True
                    violation_reason = f"Person away for {away_duration:.1f}s"
                    self._throttled_log('violation_away', f"[VIOLATION] ⚠️  Person away for {away_duration:.1f}s!")
            
            # Check if box is open (only if penalty enabled) - NEW in v2.0
            if config.enable_box_open_penalty and self.state.box_status == BoxStatus.OPEN:
                violation_detected = True
                violation_reason = "Box opened"
                self._throttled_log('violation_box_open', "[VIOLATION] ⚠️  Box opened during focus session!")
            
            # Check if environment is too noisy (only if penalty enabled)
            if config.enable_noise_penalty and self.state.noise_status == NoiseStatus.NOISY:
                violation_detected = True
                violation_reason = f"Noise detected ({self.state.current_db} dB)"
                self._throttled_log('violation_noise', f"[VIOLATION] ⚠️  Noise violation ({self.state.current_db} dB)!")
            
            if violation_detected:
                # Check penalty cooldown to prevent spam
                now = datetime.now()
                if self.last_penalty_time is None or \
                   (now - self.last_penalty_time).total_seconds() >= self.penalty_cooldown_seconds:
                    self.state.session.violations += 1
                    self.state.session.status = SessionStatus.VIOLATED
                    self.last_penalty_time = now
                    print(f"[VIOLATION] Triggering penalty: {violation_reason}")
                    await self._trigger_penalty()
                else:
                    cooldown_remaining = self.penalty_cooldown_seconds - (now - self.last_penalty_time).total_seconds()
                    print(f"[VIOLATION] Penalty on cooldown ({cooldown_remaining:.1f}s remaining)")
    
    async def _trigger_penalty(self):
        print("[懲罰協定] 啟動社交羞恥執行程序...")
        await self.broadcast_event('penalty_triggered', {
            'timestamp': datetime.now().isoformat(),
            'violations': self.state.session.violations if self.state.session else 0,
            'has_hostage': self.current_hostage_path is not None
        })
        
        # Execute registered penalty callbacks with hostage path
        for callback in self.penalty_callbacks:
            try:
                await callback(self.state, self.current_hostage_path)
            except Exception as e:
                print(f"[錯誤] 懲罰回調執行失敗: {e}")
        
        if self.state.session:
            self.state.session.penalties_executed += 1
    
    def register_penalty_callback(self, callback: Callable):
        self.penalty_callbacks.append(callback)
    
    async def start_focus_session(self, duration_minutes: int, hostage_path: Optional[str] = None):
        import uuid
        
        self.current_hostage_path = hostage_path
        self.last_penalty_time = None
        self.state.session = FocusSession(
            id=str(uuid.uuid4()),
            duration_minutes=duration_minutes,
            start_time=datetime.now(),
            status=SessionStatus.ACTIVE,
            penalty_config=self.state.penalty_config
        )
        print(f"[專注協定] 已啟動 {duration_minutes} 分鐘專注任務")
        print(f"[專注協定] 懲罰配置: {self.state.penalty_config.model_dump()}")
        if hostage_path:
            print(f"[人質協定] 人質照片已綁定: {hostage_path}")
        await self.broadcast_state(force=True)
        
        # v1.0: Send START command to hardware state machine
        await self.sio.emit('command', {'command': 'START'})
    
    async def stop_focus_session(self):
        if self.state.session:
            self.state.session.status = SessionStatus.COMPLETED
            self.state.session.end_time = datetime.now()
            print("[專注協定] 專注任務已結束")
            self.state.session = None
        
        self.current_hostage_path = None
        
        # v1.0: Send STOP command to hardware state machine
        await self.sio.emit('command', {'command': 'STOP'})
        
        await self.broadcast_state(force=True)
    
    async def pause_focus_session(self):
        """Pause the current focus session (v1.0 new feature)."""
        if self.state.session and self.state.session.status == SessionStatus.ACTIVE:
            self.state.session.status = SessionStatus.PAUSED
            await self.sio.emit('command', {'command': 'PAUSE'})
            print("[專注協定] 專注任務已暫停")
            await self.broadcast_state(force=True)
    
    async def resume_focus_session(self):
        """Resume a paused focus session (v1.0 new feature)."""
        if self.state.session and self.state.session.status == SessionStatus.PAUSED:
            self.state.session.status = SessionStatus.ACTIVE
            await self.sio.emit('command', {'command': 'RESUME'})
            print("[專注協定] 專注任務已恢復")
            await self.broadcast_state(force=True)
    
    async def acknowledge_violation(self):
        """Acknowledge a violation and return to idle (v1.0 new feature)."""
        if self.state.session and self.state.session.status == SessionStatus.VIOLATED:
            await self.sio.emit('command', {'command': 'ACKNOWLEDGE'})
            print("[專注協定] 違規已確認，返回待機狀態")
    
    def _serialize_state(self) -> dict:
        """Serialize system state for transmission."""
        state_dict = self.state.model_dump()
        # Convert datetime objects to ISO format
        if self.state.session:
            if self.state.session.start_time:
                state_dict['session']['start_time'] = self.state.session.start_time.isoformat()
            if self.state.session.end_time:
                state_dict['session']['end_time'] = self.state.session.end_time.isoformat()
        if self.state.person_away_since:
            state_dict['person_away_since'] = self.state.person_away_since.isoformat()
        # Convert enums to values
        state_dict['hardware_state'] = self.state.hardware_state.value
        return state_dict
    
    async def broadcast_state(self, force: bool = False):
        now = datetime.now()
        if not force and self.last_broadcast_time:
            elapsed_ms = (now - self.last_broadcast_time).total_seconds() * 1000
            if elapsed_ms < self.broadcast_throttle_ms:
                return
        
        self.last_broadcast_time = now
        await self.sio.emit('system_state', self._serialize_state())
    
    async def broadcast_event(self, event: str, data: dict):
        await self.sio.emit(event, data)
    
    def get_sensor_detection_status(self) -> tuple:
        """Get current sensor detection status (nfc_detected, ldr_detected, radar_detected)."""
        if self.mock_mode_active:
            return True, True, True
        elif self.hardware_connected:
            return self.physical_nfc_detected, self.physical_ldr_detected, self.physical_radar_detected
        else:
            return False, False, False
    
    def _throttled_log(self, log_key: str, message: str, force: bool = False):
        """Log a message but throttle repeated messages."""
        if force:
            print(message)
            return
        
        now = datetime.now()
        last_time = self.last_log_time.get(log_key)
        
        if last_time is None or (now - last_time).total_seconds() >= self.log_throttle_seconds:
            print(message)
            self.last_log_time[log_key] = now
    
    async def _reset_system_state(self):
        """Reset system state when switching hardware modes"""
        self.state.last_sensor_data = None
        self.state.current_db = 40  # Default noise level
        self.state.phone_status = PhoneStatus.UNKNOWN
        self.state.presence_status = PresenceStatus.UNKNOWN
        self.state.box_status = BoxStatus.UNKNOWN
        self.state.noise_status = NoiseStatus.UNKNOWN
        self.state.person_away_since = None
        await self.broadcast_state(force=True)
        print("[SYSTEM] State reset due to hardware mode change")

    async def start_mock_hardware(self):
        """Start mock hardware simulation. Can override physical hardware if requested."""
        # Check if mock mode is already running
        if self.mock_mode_active:
            print("[MOCK] Hardware simulation already running")
            await self.broadcast_event('hardware_status', {
                'connected': True, 
                'mock_mode': True,
                'mock_state': self.mock_state.to_dict(),
                'nfc_detected': True,
                'ldr_detected': True,
                'radar_detected': True
            })
            return
        
        # If physical hardware is connected, we will override it
        if self.hardware_connected:
            print("[MOCK] Physical hardware detected - switching to mock mode")
            print("[MOCK] Real hardware data will be completely ignored")
        
        try:
            # Set mock mode FIRST to prevent any incoming hardware data from being processed
            self.mock_mode_active = True
            
            await self._reset_system_state()  # Reset state before starting mock
            
            # Cancel any existing mock task
            if self.mock_task and not self.mock_task.done():
                self.mock_task.cancel()
                try:
                    await self.mock_task
                except asyncio.CancelledError:
                    pass
            
            self.mock_task = asyncio.create_task(self._mock_hardware_loop())
            self.hardware_connected = True  # Mock hardware is now "connected"
            print("[MOCK] Hardware simulation started")
            
            # Broadcast immediately with full status
            await self.broadcast_event('hardware_status', {
                'connected': True, 
                'mock_mode': True,
                'mock_state': self.mock_state.to_dict(),
                'nfc_detected': True,  # Mock hardware always has NFC
                'ldr_detected': True,  # Mock hardware always has LDR
                'radar_detected': True  # Mock hardware always has radar
            })
            
            # Send initial sensor data immediately for instant feedback
            initial_mock_data = {
                'nfc_id': 'PHONE_MOCK_001' if (self.mock_state.phone_inserted and self.mock_state.nfc_valid) else None,
                'gyro_x': 0.0,
                'gyro_y': 0.0,
                'gyro_z': 0.0,
                'radar_presence': self.mock_state.person_present,
                'mic_db': 45,
                'box_locked': not self.mock_state.box_open,
                'box_open': self.mock_state.box_open,
                'timestamp': int(datetime.now().timestamp() * 1000),
                'nfc_detected': True,
                'gyro_detected': False,
                'ldr_detected': True
            }
            await self.process_sensor_data(initial_mock_data)
            
        except Exception as e:
            print(f"[MOCK ERROR] Failed to start mock hardware: {e}")
            self.mock_mode_active = False
            self.hardware_connected = False
            await self.broadcast_event('error', {
                'message': f'Failed to start mock hardware: {str(e)}',
                'type': 'MOCK_START_FAILED'
            })

    async def stop_mock_hardware(self):
        """Stop mock hardware simulation."""
        if self.mock_task:
            self.mock_task.cancel()
            try:
                await self.mock_task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"[MOCK] Error during task cancellation: {e}")
            self.mock_task = None
        
        try:
            # Set mock_mode_active to False BEFORE resetting state
            self.mock_mode_active = False
            
            # Reset mock state when stopping
            self.mock_state = MockHardwareState()
            
            await self._reset_system_state()  # Reset state after stopping mock
            
            # Check if physical hardware is still connected
            if self.physical_hardware_ws_connected:
                # Physical hardware is connected, keep hardware_connected = True
                self.hardware_connected = True
                print("[MOCK] Hardware simulation stopped - Switching back to physical hardware")
                await self.broadcast_event('hardware_status', {
                    'connected': True,
                    'mock_mode': False,
                    'mock_state': self.mock_state.to_dict(),
                    'nfc_detected': self.physical_nfc_detected,
                    'ldr_detected': self.physical_ldr_detected,
                    'radar_detected': self.physical_radar_detected,
                    'last_sensor_data': self.state.last_sensor_data.model_dump() if self.state.last_sensor_data else None
                })
            else:
                # No physical hardware, set disconnected
                self.hardware_connected = False
                print("[MOCK] Hardware simulation stopped")
                await self.broadcast_event('hardware_status', {
                    'connected': False,
                    'mock_mode': False,
                    'mock_state': self.mock_state.to_dict(),
                    'nfc_detected': False,
                    'ldr_detected': False,
                    'radar_detected': False
                })
        except Exception as e:
            print(f"[MOCK ERROR] Error during stop: {e}")
    
    async def _mock_hardware_loop(self):
        self._throttled_log('mock_start', "[MOCK] ▶️  Sensor simulation running...", force=True)
        
        loop_count = 0
        while True:
            try:
                loop_count += 1
                # Log status every 20 iterations (every ~2 seconds at 100ms interval)
                if loop_count % 20 == 0:
                    self._throttled_log('mock_running', f"[MOCK] 📊 Simulation active - phone: {self.mock_state.phone_inserted}, person: {self.mock_state.person_present}, box_open: {self.mock_state.box_open}")
                
                # Use persistent mock_state for sensor data
                mock_data = {
                    'nfc_id': 'PHONE_MOCK_001' if (self.mock_state.phone_inserted and self.mock_state.nfc_valid) else None,
                    'gyro_x': 0.0,  # Legacy, kept for compatibility
                    'gyro_y': 0.0,
                    'gyro_z': 0.0,
                    'radar_presence': self.mock_state.person_present,
                    'mic_db': random.randint(35, 55),
                    'box_locked': not self.mock_state.box_open,  # Legacy compatibility
                    'box_open': self.mock_state.box_open,  # New: LDR sensor
                    'timestamp': int(datetime.now().timestamp() * 1000),
                    'nfc_detected': True,
                    'gyro_detected': False,  # Removed in v2.0
                    'ldr_detected': True  # New: LDR sensor
                }
                
                await self.process_sensor_data(mock_data)
                await asyncio.sleep(settings.MOCK_INTERVAL_MS / 1000)
                
            except asyncio.CancelledError:
                self._throttled_log('mock_cancel', "[MOCK] ⏹️  Simulation stopped", force=True)
                break
            except Exception as e:
                import traceback
                self._throttled_log('mock_error', f"[MOCK ERROR] ❌ {e}")
                await asyncio.sleep(1)  # Wait before retrying
    
    async def set_mock_state(self, **kwargs) -> dict:
        """Update mock hardware state and broadcast changes."""
        try:
            # Track if any state actually changed
            state_changed = False
            for key, value in kwargs.items():
                if hasattr(self.mock_state, key):
                    old_value = getattr(self.mock_state, key)
                    if old_value != value:
                        setattr(self.mock_state, key, value)
                        state_changed = True
                else:
                    self._throttled_log('mock_unknown_attr', f"[MOCK] Warning: Unknown attribute '{key}'")
            
            # Only process if state actually changed
            if not state_changed:
                return self.mock_state.to_dict()
            
            self._throttled_log('mock_state_update', f"[MOCK] 🔄 State: phone={self.mock_state.phone_inserted}, person={self.mock_state.person_present}, box_open={self.mock_state.box_open}", force=True)
            
            # Broadcast updated hardware status using helper method
            nfc_detected, ldr_detected, radar_detected = self.get_sensor_detection_status()
            await self.broadcast_event('hardware_status', {
                'connected': self.hardware_connected,
                'mock_mode': self.mock_mode_active,
                'mock_state': self.mock_state.to_dict(),
                'nfc_detected': nfc_detected,
                'ldr_detected': ldr_detected,
                'radar_detected': radar_detected
            })
            
            # If mock mode is active, immediately send sensor data with new state
            if self.mock_mode_active:
                mock_data = {
                    'nfc_id': 'PHONE_MOCK_001' if (self.mock_state.phone_inserted and self.mock_state.nfc_valid) else None,
                    'gyro_x': 0.0,
                    'gyro_y': 0.0,
                    'gyro_z': 0.0,
                    'radar_presence': self.mock_state.person_present,
                    'mic_db': random.randint(35, 55),
                    'box_locked': not self.mock_state.box_open,
                    'box_open': self.mock_state.box_open,
                    'timestamp': int(datetime.now().timestamp() * 1000),
                    'nfc_detected': True,
                    'gyro_detected': False,
                    'ldr_detected': True
                }
                await self.process_sensor_data(mock_data)
                await self.broadcast_state(force=True)
            
            return self.mock_state.to_dict()
        except Exception as e:
            print(f"[MOCK ERROR] Failed to set mock state: {e}")
            return self.mock_state.to_dict()


# Global socket manager instance
socket_manager = SocketManager()
