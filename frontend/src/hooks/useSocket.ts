import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

// ============================================================================
// API Base URL Helper
// ============================================================================
const getApiBase = () => {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isDev ? 'http://localhost:8000' : ''
}

// Socket URL for Socket.IO client (needs undefined for same-origin, not empty string)
const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isDev ? 'http://localhost:8000' : undefined
}

// ============================================================================
// v1.0 Hardware State Machine
// ============================================================================
export type HardwareState = 'IDLE' | 'PREPARING' | 'FOCUSING' | 'PAUSED' | 'VIOLATION' | 'ERROR'

export interface SensorData {
  // v1.0: Hardware state machine
  state?: HardwareState
  
  // Hall sensor (v1.0 replaces LDR)
  box_open: boolean
  
  // Radar
  radar_presence: boolean
  
  // Timestamps
  timestamp: number
  uptime?: number
  
  // Legacy fields
  nfc_id: string | null
  mic_db: number
  box_locked: boolean
  nfc_detected?: boolean
  ldr_detected?: boolean
}

export interface PenaltyConfig {
  enable_phone_penalty: boolean
  enable_presence_penalty: boolean
  enable_noise_penalty: boolean
  enable_box_open_penalty: boolean
  noise_threshold_db: number
}

export interface FocusSession {
  id: string
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'VIOLATED' | 'COMPLETED'
  violations: number
  penalties_executed: number
  penalty_config?: PenaltyConfig
}

export interface PenaltySettings {
  enabled_platforms: string[]
  custom_messages: Record<string, string>
  gmail_recipients: string[]
  include_timestamp: boolean
  include_violation_count: boolean
}

export interface SystemState {
  session: FocusSession | null
  phone_status: 'LOCKED' | 'REMOVED' | 'UNKNOWN'
  presence_status: 'DETECTED' | 'AWAY' | 'UNKNOWN'
  box_status: 'CLOSED' | 'OPEN' | 'UNKNOWN'
  noise_status: 'QUIET' | 'NOISY' | 'UNKNOWN'
  current_db: number
  last_sensor_data: SensorData | null
  
  // v1.0: Hardware state machine
  hardware_state: HardwareState
  
  // v1.0: Preparation countdown
  prepare_remaining_ms: number
  
  // Legacy
  person_away_since: string | null
  penalty_settings: PenaltySettings
  penalty_config: PenaltyConfig
}

export interface MockState {
  phone_inserted: boolean
  person_present: boolean
  nfc_valid: boolean
  box_locked: boolean
  box_open: boolean
  manual_mode: boolean
}

interface HardwareStatus {
  connected: boolean
  mock_mode?: boolean
  mock_state?: MockState
  hardware_id?: string
  version?: string
  board?: string
  features?: string  // v1.0: "hall,lcd,radar"
  nfc_detected?: boolean
  ldr_detected?: boolean
  hall_detected?: boolean  // v1.0: Hall sensor / KY-033 IR sensor
  radar_detected?: boolean
  ir_detected?: boolean    // v1.0: IR sensor detected
  lcd_detected?: boolean
  hardware_state?: HardwareState
  firmware_version?: string
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [systemState, setSystemState] = useState<SystemState | null>(null)
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus>({
    connected: false,
    mock_mode: false,
    mock_state: {
      phone_inserted: true,
      person_present: true,
      nfc_valid: true,
      box_locked: true,
      box_open: false,
      manual_mode: false
    },
    nfc_detected: false,
    ldr_detected: false,
    radar_detected: false,
    ir_detected: false,
    lcd_detected: false,
    hardware_state: 'IDLE'
  })
  const [sensorHistory, setSensorHistory] = useState<SensorData[]>([])
  const [penaltyTriggered, setPenaltyTriggered] = useState(false)
  const [mockModeLoading, setMockModeLoading] = useState(false)
  
  const historyRef = useRef<SensorData[]>([])
  const previousMockMode = useRef<boolean>(false)

  useEffect(() => {
    console.log('[WS] Initializing Socket.IO client...')
    
    // ✅ Direct connection to backend as per SOCKET_COMMUNICATION.md
    // Avoid Vite proxy for more stable WebSocket connections
    const socketUrl = getSocketUrl()
    const apiBase = getApiBase()
    
    console.log('[WS] Connecting to:', socketUrl || 'same origin')
    
    const socketInstance = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],  // Try polling first, then upgrade to WebSocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true,
      forceNew: false,
    })
    
    console.log('[WS] Socket instance created')

    socketInstance.on('connect', () => {
      console.log('[WS] ✅ Connected to Focus Enforcer v1.0')
      console.log('[WS] Socket ID:', socketInstance.id)
      console.log('[WS] Setting connected = true')
      setConnected(true)
      
      // Use absolute URL for API calls when connecting directly to backend
      fetch(`${apiBase}/api/hardware/status`)
        .then(res => res.json())
        .then(data => {
          if (import.meta.env.DEV) {
            console.log('[WS] Initial hardware status:', data)
          }
          setHardwareStatus({
            connected: data.connected,
            mock_mode: data.mock_mode,
            mock_state: data.mock_state,
            nfc_detected: data.nfc_detected,
            ldr_detected: data.ldr_detected,
            radar_detected: data.radar_detected,
            ir_detected: data.hall_detected || data.ir_detected,
            lcd_detected: data.lcd_detected,
            hardware_state: data.hardware_state || 'IDLE'
          })
        })
        .catch(err => console.error('[WS] Failed to fetch initial hardware status:', err))
    })

    socketInstance.on('disconnect', () => {
      console.log('[WS] ❌ Disconnected')
      setConnected(false)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('[WS] ❌ Connection error:', err.message)
      console.error('[WS] Error details:', err)
    })

    socketInstance.on('connect_timeout', () => {
      console.error('[WS] ❌ Connection timeout')
    })

    socketInstance.on('reconnect_attempt', (attempt) => {
      console.log(`[WS] 🔄 Reconnection attempt ${attempt}`)
    })

    socketInstance.on('reconnect_failed', () => {
      console.error('[WS] ❌ Reconnection failed - all attempts exhausted')
      setTimeout(() => {
        if (!socketInstance.connected) {
          console.log('[WS] Attempting manual reconnect...')
          socketInstance.connect()
        }
      }, 2000)
    })

    socketInstance.on('system_state', (state: SystemState) => {
      setSystemState(state)
      
      if (state.last_sensor_data) {
        historyRef.current = [...historyRef.current.slice(-59), state.last_sensor_data]
        setSensorHistory([...historyRef.current])
      }
    })

    socketInstance.on('hardware_status', (status: HardwareStatus) => {
      console.log('[WS] Received hardware_status:', status)
      
      if ((socketInstance as any)._mockToggleTimeout) {
        clearTimeout((socketInstance as any)._mockToggleTimeout)
        ;(socketInstance as any)._mockToggleTimeout = null
      }
      
      if (previousMockMode.current === true && status.mock_mode === false) {
        console.log('[WS] Mock mode disabled - clearing all sensor data')
        historyRef.current = []
        setSensorHistory([])
        setSystemState(prev => prev ? {
          ...prev,
          last_sensor_data: null
        } : null)
      }
      
      previousMockMode.current = status.mock_mode || false
      setMockModeLoading(false)
      
      setHardwareStatus({
        connected: status.connected,
        mock_mode: status.mock_mode,
        mock_state: status.mock_state,
        hardware_id: status.hardware_id,
        version: status.version,
        board: status.board,
        features: status.features,
        nfc_detected: status.nfc_detected,
        ldr_detected: status.ldr_detected,
        radar_detected: status.radar_detected,
        ir_detected: status.hall_detected || status.ir_detected,
        lcd_detected: status.lcd_detected,
        hardware_state: status.hardware_state || 'IDLE',
        firmware_version: status.firmware_version
      })
    })

    socketInstance.on('penalty_triggered', () => {
      setPenaltyTriggered(true)
      setTimeout(() => setPenaltyTriggered(false), 5000)
    })
    
    // v1.0: Hardware state machine change event
    socketInstance.on('hardware_state_change', (data: {
      previous_state: HardwareState
      current_state: HardwareState
      total_focus_time_ms: number
    }) => {
      console.log('[WS] Hardware state change:', data.previous_state, '→', data.current_state)
      setHardwareStatus(prev => ({
        ...prev,
        hardware_state: data.current_state
      }))
    })
    
    socketInstance.on('error', (error: any) => {
      console.error('[WS] Socket error:', error)
      setMockModeLoading(false)
      if ((socketInstance as any)._mockToggleTimeout) {
        clearTimeout((socketInstance as any)._mockToggleTimeout)
        ;(socketInstance as any)._mockToggleTimeout = null
      }
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const startSession = useCallback(async (durationMinutes: number) => {
    socket?.emit('start_session', { duration_minutes: durationMinutes })
  }, [socket])

  const stopSession = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/sessions/stop`, {
        method: 'POST',
      })
      if (!response.ok) {
        console.error('[專注協定] 停止失敗:', await response.text())
      }
    } catch (error) {
      console.error('[專注協定] 停止失敗:', error)
    }
  }, [])

  // v1.0: Pause session
  const pauseSession = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/sessions/pause`, { method: 'POST' })
      if (!response.ok) {
        console.error('[專注協定] 暫停失敗:', await response.text())
      }
    } catch (error) {
      console.error('[專注協定] 暫停失敗:', error)
    }
  }, [])

  // v1.0: Resume session
  const resumeSession = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/sessions/resume`, { method: 'POST' })
      if (!response.ok) {
        console.error('[專注協定] 恢復失敗:', await response.text())
      }
    } catch (error) {
      console.error('[專注協定] 恢復失敗:', error)
    }
  }, [])

  const toggleMockHardware = useCallback((enabled: boolean) => {
    console.log('[WS] Toggling mock hardware:', enabled, 'socket connected:', socket?.connected)
    if (!socket?.connected) {
      console.error('[WS] Cannot toggle mock hardware: socket not connected')
      return
    }
    setMockModeLoading(true)
    socket.emit('toggle_mock_hardware', { enabled })
    
    const timeoutId = setTimeout(() => {
      console.warn('[WS] Mock hardware toggle timeout - clearing loading state')
      setMockModeLoading(false)
    }, 5000)
    
    ;(socket as any)._mockToggleTimeout = timeoutId
  }, [socket])

  const updatePenaltySettings = useCallback((settings: PenaltySettings) => {
    socket?.emit('update_penalty_settings', settings)
  }, [socket])

  const updatePenaltyConfig = useCallback((config: PenaltyConfig) => {
    socket?.emit('update_penalty_config', config)
  }, [socket])

  const sendManualSensorData = useCallback(async (data: {
    phone_inserted: boolean
    person_present: boolean
    nfc_valid: boolean
    box_open: boolean
  }) => {
    try {
      const response = await fetch(`${getApiBase()}/api/hardware/mock/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        console.error('[DEV] Manual sensor control failed:', await response.text())
      }
    } catch (error) {
      console.error('[DEV] Manual sensor control error:', error)
    }
  }, [])

  return {
    connected,
    systemState,
    hardwareStatus,
    sensorHistory,
    penaltyTriggered,
    mockModeLoading,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    toggleMockHardware,
    updatePenaltySettings,
    updatePenaltyConfig,
    sendManualSensorData,
  }
}
