import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { api } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'

/**
 * 輔助函式：判斷並取得 Socket.IO 的連線 URL。
 * 為了確保連線穩定，在本地開發環境 (localhost) 下直接指定後端埠號，
 * 生產環境則回傳 undefined，讓客戶端使用 Same-origin 連線。
 */
const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isDev ? 'http://localhost:8000' : undefined
}

/**
 * v1.0 硬體狀態機的狀態定義。
 */
export type HardwareState = 'IDLE' | 'PREPARING' | 'FOCUSING' | 'PAUSED' | 'VIOLATION' | 'ERROR'

/**
 * 原始感測器數據介面。
 * 包含了硬體狀態、感知器偵測結果 (如 LDR, Radar) 以及傳統 NFC 欄位。
 */
export interface SensorData {
  // v1.0 硬體狀態機當前狀態
  state?: HardwareState

  // 霍爾感測器偵測結果 (v1.0 替代 LDR，檢測盒子是否開啟)
  box_open: boolean

  // 雷達感測器，判斷人員是否在場
  radar_presence: boolean

  // 時間戳記與運作時間
  timestamp: number
  uptime?: number

  // 舊版與各類遺留欄位
  nfc_id: string | null
  mic_db: number
  box_locked: boolean
  nfc_detected?: boolean
  ldr_detected?: boolean
}

/**
 * 單次違規判斷的配置參數。
 */
export interface PenaltyConfig {
  enable_phone_penalty: boolean    // 是否啟用手機移除處罰
  enable_presence_penalty: boolean // 是否啟用人員離開處罰
  enable_noise_penalty: boolean    // 是否啟用噪音過大處罰
  enable_box_open_penalty: boolean // 是否啟用盒子被開啟處罰
  noise_threshold_db: number       // 噪音觸發閾值 (分貝)
  noise_duration_sec?: number      // 噪音需持續多久才視為違規
  presence_duration_sec?: number   // 人員離開多久後開始處罰
}

/**
 * 專注會話 (Session) 的詳細資訊。
 */
export interface FocusSession {
  id: string
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'VIOLATED' | 'COMPLETED'
  violations: number               // 當前會話中的累計違規次數
  penalties_executed: number       // 實際執行的處罰次數
  penalty_config?: PenaltyConfig   // 此會話套用的配置
}

/**
 * 階段性懲罰規則。
 */
export interface ProgressivePenaltyRule {
  violationCount: number   // 違規次數門檻 (對應後端 violation_count)
  platforms: string[]      // 觸發的平台列表
}

/**
 * 社交平台發文處罰的具體設定。
 */
export interface PenaltySettings {
  enabled_platforms: string[]       // 已啟用的平台 (如 Gmail, Threads, Discord)
  custom_messages: Record<string, string> // 各平台的自訂羞辱文字
  gmail_recipients: string[]        // 電子郵件收件者列清單
  include_timestamp: boolean        // 是否在貼文中包含時間
  include_violation_count: boolean  // 是否包含違規計數
  progressive_rules?: ProgressivePenaltyRule[]  // 階段性懲罰規則
}

/**
 * 全域系統狀態，彙整了會話、狀態機、感測器狀態及配置。
 */
export interface SystemState {
  session: FocusSession | null
  phone_status: 'LOCKED' | 'REMOVED' | 'UNKNOWN'
  presence_status: 'DETECTED' | 'AWAY' | 'UNKNOWN'
  box_status: 'CLOSED' | 'OPEN' | 'UNKNOWN'
  noise_status: 'QUIET' | 'NOISY' | 'UNKNOWN'
  current_db: number
  last_sensor_data: SensorData | null

  // v1.0 硬體狀態機狀態
  hardware_state: HardwareState

  // v1.0 準備階段的倒數計時 (毫秒)
  prepare_remaining_ms: number

  // 遺留欄位與設定
  person_away_since: string | null
  noise_start_time: string | null  // 噪音開始時間（用於倒數顯示）
  penalty_settings: PenaltySettings
  penalty_config: PenaltyConfig

  // Phase 3: 全域違規計數
  today_violation_count: number
}

/**
 * 階梯式處罰等級 (Phase 3)。
 */
export type PenaltyLevel = 'NONE' | 'PENALTY'

/**
 * 處罰等級變更事件。
 */
export interface PenaltyLevelEvent {
  level: PenaltyLevel
  count: number
  today_count?: number  // 今日違規總次數
  reason: string
  action: 'social_post'
}

/**
 * 處罰狀態細節，用於 UI 呈現警告時段。
 */
export interface PenaltyState {
  type: 'penalty_warning' | 'penalty_executed' | 'penalty_cancelled'
  level?: PenaltyLevel
  violation_count: number
  today_violation_count?: number  // 今日違規總次數
  grace_period_seconds?: number    // 寬限期剩餘秒數
  message?: string
  reason?: string
}

/**
 * 模擬硬體的內部狀態。
 */
export interface MockState {
  phone_inserted: boolean
  person_present: boolean
  nfc_valid: boolean
  box_locked: boolean
  box_open: boolean
  manual_mode: boolean
  noise_min?: number
  noise_max?: number
}

/**
 * 硬體連線與功能狀態彙整。
 */
interface HardwareStatus {
  connected: boolean               // 是否與實體 ESP32 連線
  mock_mode?: boolean              // 是否處於模擬模式
  mock_state?: MockState
  hardware_id?: string
  version?: string
  board?: string
  features?: string                // 功能旗標，如 "hall,lcd,radar"
  nfc_detected?: boolean
  ldr_detected?: boolean
  hall_detected?: boolean          // 霍爾或紅外線感測器
  radar_detected?: boolean
  ir_detected?: boolean            // 紅外線感測器
  lcd_detected?: boolean
  hardware_state?: HardwareState
  firmware_version?: string
}

/**
 * `useSocket` Hook：前端的核心通訊樞紐。
 * 負責處理所有的 WebSocket 事件、維護 React 狀態，並提供與後端互動的操作方法。
 */
export function useSocket() {
  const { t } = useLanguage()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [systemState, setSystemState] = useState<SystemState | null>(null)

  // 硬體狀態預設值
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus>({
    connected: false,
    mock_mode: false,
    mock_state: {
      phone_inserted: true,
      person_present: true,
      nfc_valid: true,
      box_locked: true,
      box_open: false,
      manual_mode: false,
      noise_min: 35,
      noise_max: 55
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

  // Phase 3: 階梯處罰相關狀態
  const [penaltyLevel, setPenaltyLevel] = useState<PenaltyLevel>('NONE')
  const [penaltyGracePeriod, setPenaltyGracePeriod] = useState(0)
  const [violationCount, setViolationCount] = useState(0)
  const [todayViolationCount, setTodayViolationCount] = useState(0)

  // Phase 5: 地獄模式狀態切換 (僅限 UI 展示)
  const [hellMode, setHellMode] = useState(false)

  // 處罰執行進度狀態
  const [penaltyStep, setPenaltyStep] = useState<string>('pending')

  // 動態步驟列表：根據當前配置生成需要執行的步驟
  interface DynamicPenaltyStep {
    id: string
    label: string
    status: 'pending' | 'in-progress' | 'completed' | 'error'
  }

  /**
   * 根據當前系統配置，動態生成懲罰執行所需的步驟列表。
   * 僅顯示實際會執行的步驟，避免顯示無關項目造成用戶困惑。
   */
  const generatePenaltySteps = useCallback((): DynamicPenaltyStep[] => {
    const settings = systemState?.penalty_settings
    const steps: DynamicPenaltyStep[] = []

    // 檢查各平台是否啟用
    const hasDiscord = settings?.enabled_platforms?.includes('discord')
    const hasThreads = settings?.enabled_platforms?.includes('threads')
    const hasGmail = settings?.enabled_platforms?.includes('gmail') &&
      settings?.gmail_recipients &&
      settings.gmail_recipients.length > 0

    const hasAnyPlatform = hasDiscord || hasThreads || hasGmail

    // 如果沒有任何平台啟用，返回空列表
    if (!hasAnyPlatform) {
      return []
    }

    // 步驟 1: 驗證憑證
    steps.push({ id: 'auth', label: t('penaltyStep.auth'), status: 'pending' })

    // 步驟 2: 準備人質照片 (當 Threads 或 Gmail 啟用時才需要)
    // 注意：這裡假設有人質照片，實際可從 API 獲取
    if (hasThreads || hasGmail) {
      steps.push({ id: 'upload_image', label: t('penaltyStep.uploadImage'), status: 'pending' })
    }

    // 步驟 3-5: 各平台執行
    if (hasDiscord) {
      steps.push({ id: 'discord', label: t('penaltyStep.discord'), status: 'pending' })
    }
    if (hasThreads) {
      steps.push({ id: 'threads', label: t('penaltyStep.threads'), status: 'pending' })
    }
    if (hasGmail) {
      steps.push({ id: 'email', label: t('penaltyStep.email'), status: 'pending' })
    }

    // 步驟 6: 完成
    steps.push({ id: 'complete', label: t('penaltyStep.complete'), status: 'pending' })

    return steps
  }, [systemState, t])

  // 動態生成的步驟列表
  const penaltySteps = generatePenaltySteps()

  /**
   * 模擬執行處罰的步驟動畫流程。
   * 使用動態生成的步驟列表來驅動進度顯示。
   * 當動畫完成（最後一步）時，呼叫後端 API 觸發實際的懲罰訊息發送。
   */
  const simulatePenaltyProgress = useCallback(() => {
    const steps = generatePenaltySteps()

    // 如果沒有任何步驟，直接結束
    if (steps.length === 0) {
      setTimeout(() => {
        setPenaltyTriggered(false)
        setPenaltyStep('pending')
      }, 2000)
      return
    }

    const stepIds = steps.map(s => s.id)
    let currentStepIndex = 0

    const nextStep = () => {
      if (currentStepIndex < stepIds.length) {
        setPenaltyStep(stepIds[currentStepIndex])
        currentStepIndex++

        // 模擬隨機處理延遲，呈現真實感
        const delay = Math.random() * 200 + 600 // ~700ms per step
        setTimeout(nextStep, delay)
      } else {
        // 標記所有步驟已完成，觸發完成動畫
        setPenaltyStep('_complete')

        // 動畫完成後，呼叫後端 API 執行實際的懲罰發送
        console.log('[懲罰動畫] 動畫完成，呼叫後端執行實際發送...')
        api.post('/api/penalty/execute')
          .then(() => {
            console.log('[懲罰動畫] ✅ 後端懲罰發送完成')
          })
          .catch((error) => {
            console.error('[懲罰動畫] ❌ 後端懲罰發送失敗:', error)
          })

        // 完成後自動重設狀態
        setTimeout(() => {
          setPenaltyTriggered(false)
          setPenaltyStep('pending')
        }, 3000)
      }
    }

    nextStep()
  }, [generatePenaltySteps])


  // 使用 Ref 紀錄歷史數據以避免頻繁觸發 useEffect 閉包問題
  const historyRef = useRef<SensorData[]>([])
  const previousMockMode = useRef<boolean>(false)
  // 保存 simulatePenaltyProgress 的最新引用，解決 socket 事件處理器閉包問題
  const simulatePenaltyProgressRef = useRef(simulatePenaltyProgress)

  // 保持 ref 同步最新的函數引用
  useEffect(() => {
    simulatePenaltyProgressRef.current = simulatePenaltyProgress
  }, [simulatePenaltyProgress])

  useEffect(() => {
    console.log('[WS] Initializing Socket.IO client...')

    const socketUrl = getSocketUrl()
    console.log('[WS] Connecting to:', socketUrl || 'same origin')

    // 初始化 Socket.IO 客戶端
    const socketInstance = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'], // 支援長輪詢自動升級至 WebSocket
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

    // --- 連線核心事件監聽 ---

    socketInstance.on('connect', () => {
      console.log('[WS] ✅ Connected to Focus Enforcer v1.0')
      console.log('[WS] Socket ID:', socketInstance.id)
      setConnected(true)

      // 連線後主動拉取一次硬體狀態，確保 UI 資訊與實際硬體同步
      api.get<HardwareStatus>('/api/hardware/status')
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
    })

    socketInstance.on('reconnect_attempt', (attempt) => {
      console.log(`[WS] 🔄 Reconnection attempt ${attempt}`)
    })

    socketInstance.on('reconnect_failed', () => {
      console.error('[WS] ❌ Reconnection failed - all attempts exhausted')
      // 若自動重連失敗，定時觸發手動重連嘗試
      setTimeout(() => {
        if (!socketInstance.connected) {
          console.log('[WS] Attempting manual reconnect...')
          socketInstance.connect()
        }
      }, 2000)
    })

    // --- 業務數據事件監聽 ---

    // 接收來自伺服器的全局狀態更新 (廣播)
    socketInstance.on('system_state', (state: SystemState) => {
      setSystemState(state)

      // 更新即時感測器圖表歷史
      if (state.last_sensor_data) {
        historyRef.current = [...historyRef.current.slice(-59), state.last_sensor_data]
        setSensorHistory([...historyRef.current])
      }

      // 同步全域今日違規次數
      if (state.today_violation_count !== undefined) {
        setTodayViolationCount(state.today_violation_count)
      }
    })

    // 接收硬體狀態變更事件
    socketInstance.on('hardware_status', (status: HardwareStatus) => {
      console.log('[WS] Received hardware_status:', status)

      // 清除模擬切換的 Loading 定時器
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((socketInstance as any)._mockToggleTimeout) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clearTimeout((socketInstance as any)._mockToggleTimeout)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ; (socketInstance as any)._mockToggleTimeout = null
      }

      // 如果從模擬模式切換回實體，清空緩存數據以防混淆
      if (previousMockMode.current === true && status.mock_mode === false) {
        console.log('[WS] Mock mode disabled - clearing all sensor data')
        historyRef.current = []
        setSensorHistory([])
        setSystemState(prev => prev ? { ...prev, last_sensor_data: null } : null)
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

    // 當處罰正式啟動時触發
    socketInstance.on('penalty_triggered', (data?: { today_violation_count?: number }) => {
      setPenaltyTriggered(true)
      simulatePenaltyProgressRef.current()
      // 更新今日違規次數
      if (data?.today_violation_count !== undefined) {
        setTodayViolationCount(data.today_violation_count)
      }
    })

    // 監聽硬體狀態機轉換事件
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

    // 接收處罰等級變化提示
    socketInstance.on('penalty_level', (data: PenaltyLevelEvent) => {
      console.log('[WS] 🚨 Penalty level:', data.level, '-', data.reason)
      setPenaltyLevel(data.level)
      setViolationCount(data.count)
      // 更新今日違規次數
      if (data.today_count !== undefined) {
        setTodayViolationCount(data.today_count)
      }
    })

    // 接收處罰狀態與寬限期資訊
    socketInstance.on('penalty_state', (data: PenaltyState) => {
      console.log('[WS] ⚡ Penalty state:', data.type)
      if (data.grace_period_seconds) {
        setPenaltyGracePeriod(data.grace_period_seconds)
      }
      if (data.violation_count !== undefined) {
        setViolationCount(data.violation_count)
      }
      if (data.today_violation_count !== undefined) {
        setTodayViolationCount(data.today_violation_count)
      }
      if (data.type === 'penalty_cancelled') {
        setPenaltyLevel('NONE')
      }
      // 處罰執行時觸發進度顯示
      if (data.type === 'penalty_executed') {
        setPenaltyTriggered(true)
        simulatePenaltyProgressRef.current()
      }
    })

    socketInstance.on('error', (error: Error) => {
      console.error('[WS] Socket error:', error)
      setMockModeLoading(false)
    })

    setSocket(socketInstance)

    return () => {
      // 組件卸載時斷開連線
      socketInstance.disconnect()
    }
  }, [])

  // --- 操作回調定義 ---

  /** 啟動專注任務 */
  const startSession = useCallback(async (durationMinutes: number) => {
    socket?.emit('start_session', { duration_minutes: durationMinutes })
  }, [socket])

  /** 停止專注任務 */
  const stopSession = useCallback(async () => {
    try {
      await api.post('/api/sessions/stop')
    } catch (error) {
      console.error('[專注協定] 停止失敗:', error)
    }
  }, [])

  /** 暫停專注任務 (v1.0) */
  const pauseSession = useCallback(async () => {
    try {
      await api.post('/api/sessions/pause')
    } catch (error) {
      console.error('[專注協定] 暫停失敗:', error)
    }
  }, [])

  /** 恢復專注任務 (v1.0) */
  const resumeSession = useCallback(async () => {
    try {
      await api.post('/api/sessions/resume')
    } catch (error) {
      console.error('[專注協定] 恢復失敗:', error)
    }
  }, [])

  /** 切換模擬硬體模式 */
  const toggleMockHardware = useCallback((enabled: boolean) => {
    if (!socket?.connected) {
      console.error('[WS] Cannot toggle mock hardware: socket not connected')
      return
    }
    setMockModeLoading(true)
    socket.emit('toggle_mock_hardware', { enabled })

    const timeoutId = setTimeout(() => {
      setMockModeLoading(false)
    }, 5000)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (socket as any)._mockToggleTimeout = timeoutId
  }, [socket])

  /** 更新處罰平台設定 (如平台開關、自訂訊息、收件人) */
  const updatePenaltySettings = useCallback((settings: PenaltySettings) => {
    socket?.emit('update_penalty_settings', settings)
  }, [socket])

  /** 更新處罰觸發條件 (如分貝閾值、持續時間) */
  const updatePenaltyConfig = useCallback((config: PenaltyConfig) => {
    socket?.emit('update_penalty_config', config)
  }, [socket])

  /** 手動覆寫模擬感測器數據 (僅開發介面使用) */
  const sendManualSensorData = useCallback(async (data: {
    phone_inserted: boolean
    person_present: boolean
    nfc_valid: boolean
    box_open: boolean
    noise_min?: number
    noise_max?: number
  }) => {
    try {
      await api.post('/api/hardware/mock/manual', data)
    } catch (error) {
      console.error('[DEV] Manual sensor control error:', error)
    }
  }, [])

  /** 切換地獄模式風格 */
  const toggleHellMode = useCallback(() => {
    setHellMode(prev => !prev)
  }, [])

  // 暴露狀態與方法
  return {
    connected,
    systemState,
    hardwareStatus,
    sensorHistory,
    penaltyTriggered,
    penaltyStep,
    penaltySteps,  // 動態步驟列表
    mockModeLoading,
    penaltyLevel,
    penaltyGracePeriod,
    violationCount,
    todayViolationCount,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    toggleMockHardware,
    updatePenaltySettings,
    updatePenaltyConfig,
    sendManualSensorData,
    hellMode,
    toggleHellMode,
  }
}
