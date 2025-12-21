import { 
  Smartphone, 
  User, 
  Volume2, 
  Wifi, 
  WifiOff,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Box,
  BoxSelect,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  Target
} from 'lucide-react';
import React from 'react';

// v1.0: Hardware state machine states
type HardwareState = 'IDLE' | 'PREPARING' | 'FOCUSING' | 'PAUSED' | 'VIOLATION' | 'ERROR';

interface StatusPanelProps {
  phoneStatus: 'LOCKED' | 'REMOVED' | 'UNKNOWN'
  presenceStatus: 'DETECTED' | 'AWAY' | 'UNKNOWN'
  boxStatus: 'CLOSED' | 'OPEN' | 'UNKNOWN'
  currentDb: number
  hardwareConnected: boolean
  isMock?: boolean
  hardwareBoard?: string
  nfcDetected?: boolean
  ldrDetected?: boolean
  radarDetected?: boolean
  // v1.0: New state props
  hardwareState?: HardwareState
  prepareRemainingMs?: number
  hallDetected?: boolean
  lcdDetected?: boolean
}

export function StatusPanel({ 
  phoneStatus, 
  presenceStatus,
  boxStatus,
  currentDb,
  hardwareConnected,
  isMock,
  hardwareBoard = 'D1-mini',
  nfcDetected = false,
  ldrDetected = false,
  radarDetected = false,
  // v1.0: New props
  hardwareState = 'IDLE',
  prepareRemainingMs = 0,
  hallDetected = false,
  lcdDetected = false
}: StatusPanelProps) {
  const [displayDb, setDisplayDb] = React.useState(currentDb);
  const [prevPhoneStatus, setPrevPhoneStatus] = React.useState(phoneStatus);
  const [prevPresenceStatus, setPrevPresenceStatus] = React.useState(presenceStatus);
  const [phoneStatusChanged, setPhoneStatusChanged] = React.useState(false);
  const [presenceStatusChanged, setPresenceStatusChanged] = React.useState(false);
  const [dbValueChanged, setDbValueChanged] = React.useState(false);
  const animationFrameRef = React.useRef<number | null>(null);

  // Smooth DB value animation with interpolation
  React.useEffect(() => {
    // Cancel any ongoing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Don't update DB value if hardware is disconnected
    if (!hardwareConnected) {
      return;
    }

    if (Math.abs(currentDb - displayDb) > 0.5) {
      setDbValueChanged(true);
      
      const startValue = displayDb;
      const endValue = currentDb;
      const duration = 600; // 600ms smooth transition
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function: cubic-bezier(0.16, 1, 0.3, 1)
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const interpolatedValue = startValue + (endValue - startValue) * easeProgress;
        setDisplayDb(interpolatedValue);
        
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDbValueChanged(false);
          animationFrameRef.current = null;
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentDb, hardwareConnected]);

  React.useEffect(() => {
    if (phoneStatus !== prevPhoneStatus) {
      setPhoneStatusChanged(true);
      setPrevPhoneStatus(phoneStatus);
      const timer = setTimeout(() => setPhoneStatusChanged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [phoneStatus]);

  React.useEffect(() => {
    if (presenceStatus !== prevPresenceStatus) {
      setPresenceStatusChanged(true);
      setPrevPresenceStatus(presenceStatus);
      const timer = setTimeout(() => setPresenceStatusChanged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [presenceStatus]);

  const getPhoneStatusConfig = () => {
    // If hardware is not connected OR NFC sensor is not detected, show gray disconnected state
    if (!hardwareConnected || !nfcDetected) {
      return { 
        icon: Smartphone, 
        label: '感測器未連接', 
        color: 'text-gray-400',
        bg: 'bg-gray-900/10',
        border: 'border-gray-500/30'
      }
    }

    switch (phoneStatus) {
      case 'LOCKED':
        return { 
          icon: Lock, 
          label: '裝置鎖定中', 
          color: 'text-neon-green',
          bg: 'bg-neon-green/10',
          border: 'border-neon-green/30'
        }
      case 'REMOVED':
        return { 
          icon: Unlock, 
          label: '裝置已移除！', 
          color: 'text-neon-red',
          bg: 'bg-neon-red/10',
          border: 'border-neon-red/30'
        }
      default:
        return { 
          icon: Smartphone, 
          label: '狀態未知', 
          color: 'text-mac-textSecondary',
          bg: 'bg-white/5',
          border: 'border-white/10'
        }
    }
  }

  const getPresenceConfig = () => {
    // If hardware is not connected OR radar sensor is not detected, show gray disconnected state
    if (!hardwareConnected || !radarDetected) {
      return { 
        icon: User, 
        label: radarDetected ? '雷達未連接' : '雷達未安裝', 
        color: 'text-gray-400',
        bg: 'bg-gray-900/10',
        border: 'border-gray-500/30'
      }
    }

    switch (presenceStatus) {
      case 'DETECTED':
        return { 
          icon: Eye, 
          label: '人員在座', 
          color: 'text-neon-green',
          bg: 'bg-neon-green/10',
          border: 'border-neon-green/30'
        }
      case 'AWAY':
        return { 
          icon: EyeOff, 
          label: '人員離座', 
          color: 'text-neon-red',
          bg: 'bg-neon-red/10',
          border: 'border-neon-red/30'
        }
      default:
        return { 
          icon: User, 
          label: '狀態未知', 
          color: 'text-mac-textSecondary',
          bg: 'bg-white/5',
          border: 'border-white/10'
        }
    }
  }

  const getBoxStatusConfig = () => {
    // v1.0: Hall sensor replaces LDR for box status
    if (!hardwareConnected || !hallDetected) {
      return { 
        icon: Box, 
        label: '霍爾感測器未連接', 
        color: 'text-gray-400',
        bg: 'bg-gray-900/10',
        border: 'border-gray-500/30'
      }
    }

    switch (boxStatus) {
      case 'CLOSED':
        return { 
          icon: Box, 
          label: '盒蓋關閉', 
          color: 'text-neon-green',
          bg: 'bg-neon-green/10',
          border: 'border-neon-green/30'
        }
      case 'OPEN':
        return { 
          icon: BoxSelect, 
          label: '盒蓋開啟！', 
          color: 'text-neon-red',
          bg: 'bg-neon-red/10',
          border: 'border-neon-red/30'
        }
      default:
        return { 
          icon: Box, 
          label: '狀態未知', 
          color: 'text-mac-textSecondary',
          bg: 'bg-white/5',
          border: 'border-white/10'
        }
    }
  }

  const getNoiseLevel = () => {
    // If hardware is not connected, show gray disconnected state
    if (!hardwareConnected) {
      return { 
        label: '未連接', 
        color: 'bg-gray-500 text-gray-400',
        isDisconnected: true
      };
    }

    if (displayDb < 40) {
      return { 
        label: '安靜', 
        color: 'bg-neon-green text-neon-green',
        isDisconnected: false
      };
    }
    if (displayDb < 60) {
      return { 
        label: '正常', 
        color: 'bg-neon-yellow text-neon-yellow',
        isDisconnected: false
      };
    }
    if (displayDb < 80) {
      return { 
        label: '噴鬧', 
        color: 'bg-neon-orange text-neon-orange',
        isDisconnected: false
      };
    }
    return { 
      label: '極度噴鬧', 
      color: 'bg-neon-red text-neon-red',
      isDisconnected: false
    };
  }

  const phoneConfig = getPhoneStatusConfig()
  const presenceConfig = getPresenceConfig()
  const boxConfig = getBoxStatusConfig()
  const noiseConfig = getNoiseLevel()
  const PhoneIcon = phoneConfig.icon
  const PresenceIcon = presenceConfig.icon
  const BoxIcon = boxConfig.icon

  // v1.0: Hardware state machine configuration
  const getHardwareStateConfig = () => {
    switch (hardwareState) {
      case 'IDLE':
        return {
          icon: Clock,
          label: '待機中',
          color: 'text-mac-textSecondary',
          bg: 'bg-white/5',
          border: 'border-white/10'
        };
      case 'PREPARING':
        return {
          icon: Clock,
          label: `準備中 ${Math.ceil(prepareRemainingMs / 1000)}s`,
          color: 'text-neon-yellow',
          bg: 'bg-neon-yellow/10',
          border: 'border-neon-yellow/30'
        };
      case 'FOCUSING':
        return {
          icon: Target,
          label: '專注中',
          color: 'text-neon-green',
          bg: 'bg-neon-green/10',
          border: 'border-neon-green/30'
        };
      case 'PAUSED':
        return {
          icon: Pause,
          label: '已暫停',
          color: 'text-neon-blue',
          bg: 'bg-neon-blue/10',
          border: 'border-neon-blue/30'
        };
      case 'VIOLATION':
        return {
          icon: AlertTriangle,
          label: '違規偵測',
          color: 'text-neon-red',
          bg: 'bg-neon-red/10',
          border: 'border-neon-red/30'
        };
      case 'ERROR':
        return {
          icon: AlertTriangle,
          label: '系統錯誤',
          color: 'text-neon-red',
          bg: 'bg-neon-red/10',
          border: 'border-neon-red/30'
        };
      default:
        return {
          icon: Clock,
          label: '未知',
          color: 'text-mac-textSecondary',
          bg: 'bg-white/5',
          border: 'border-white/10'
        };
    }
  };

  const hardwareStateConfig = getHardwareStateConfig();
  const HardwareStateIcon = hardwareStateConfig.icon;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Hardware Connection Status */}
      <div className={`mac-card col-span-1 sm:col-span-2 p-4 border-2 transition-all duration-300 ${
        hardwareConnected ? 'border-neon-green/30 glow-green' : 'border-neon-red/30 glow-red'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hardwareConnected ? (
              <div className="p-2 rounded-lg bg-neon-green/10">
                <Wifi className="w-5 h-5 text-neon-green" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-neon-red/10">
                <WifiOff className="w-5 h-5 text-neon-red" />
              </div>
            )}
            <div>
              <p className={`font-semibold ${hardwareConnected ? 'text-neon-green' : 'text-neon-red'}`}>
                {hardwareConnected ? '硬體連線中 ' : '硬體離線 '}
              </p>
              <p className="text-xs text-mac-textSecondary">
                {isMock ? '🎮 模擬模式' : `📡 ${hardwareBoard} `}
              </p>
            </div>
          </div>
          
          {/* v1.0: Hardware State indicators */}
          {hardwareConnected && (
            <div className="flex items-center gap-4">
              {/* Hardware State Badge */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${hardwareStateConfig.bg} border ${hardwareStateConfig.border}`}>
                <HardwareStateIcon className={`w-4 h-4 ${hardwareStateConfig.color}`} />
                <span className={`text-sm font-medium ${hardwareStateConfig.color}`}>
                  {hardwareStateConfig.label}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Sensor Detection Warnings */}
        {hardwareConnected && !isMock && (!hallDetected || !radarDetected || !lcdDetected) && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              感測器偵測警告
            </p>
            <div className="space-y-1 text-xs text-mac-textSecondary">
              {!hallDetected && (
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span>霍爾感測器 (Hall) 未偵測到 - 盒蓋磁性偵測功能將無法運作</span>
                </p>
              )}
              {!radarDetected && (
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span>毫米波雷達 (LD2410) 未偵測到 - 人員偵測功能將無法運作</span>
                </p>
              )}
              {!lcdDetected && (
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span>LCD 顯示器 (1602) 未偵測到 - 本地顯示功能將無法運作</span>
                </p>
              )}
              <p className="mt-2 text-yellow-400/70">
                💡 請檢查感測器接線並確認已正確連接
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Phone Status */}
      <div className={`mac-card p-4 border-2 ${phoneConfig.border} interactive hover-lift transition-all duration-500 ${
        phoneStatusChanged ? 'status-change' : ''
      }`}>
        <p className="text-xs text-mac-textSecondary mb-3 font-medium uppercase tracking-wider">
          裝置狀態
        </p>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${phoneConfig.bg} transition-all duration-500`}>
          <div className="p-2 rounded-lg bg-white/10">
            <PhoneIcon className={`w-6 h-6 ${phoneConfig.color} transition-all duration-500`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-base ${phoneConfig.color} transition-all duration-500`}>
              {phoneConfig.label}
            </p>
            <p className="text-xs text-mac-textSecondary">NFC 感應偵測</p>
          </div>
        </div>
      </div>

      {/* Presence Status */}
      <div className={`mac-card p-4 border-2 ${presenceConfig.border} interactive hover-lift transition-all duration-500 ${
        presenceStatusChanged ? 'status-change' : ''
      }`}>
        <p className="text-xs text-mac-textSecondary mb-3 font-medium uppercase tracking-wider">
          人員偵測
        </p>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${presenceConfig.bg} transition-all duration-500`}>
          <div className="p-2 rounded-lg bg-white/10">
            <PresenceIcon className={`w-6 h-6 ${presenceConfig.color} transition-all duration-500`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-base ${presenceConfig.color} transition-all duration-500`}>
              {presenceConfig.label}
            </p>
            <p className="text-xs text-mac-textSecondary">雷達感應器</p>
          </div>
        </div>
      </div>

      {/* Box Status - v1.0: Hall Sensor */}
      <div className={`mac-card p-4 border-2 ${boxConfig.border} interactive hover-lift transition-all duration-500`}>
        <p className="text-xs text-mac-textSecondary mb-3 font-medium uppercase tracking-wider">
          盒蓋狀態
        </p>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${boxConfig.bg} transition-all duration-500`}>
          <div className="p-2 rounded-lg bg-white/10">
            <BoxIcon className={`w-6 h-6 ${boxConfig.color} transition-all duration-500`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-base ${boxConfig.color} transition-all duration-500`}>
              {boxConfig.label}
            </p>
            <p className="text-xs text-mac-textSecondary">霍爾磁性感測器</p>
          </div>
        </div>
      </div>

      {/* Noise Level Meter - Simplified */}
      <div className={`mac-card p-4 border-2 interactive hover-lift transition-all duration-300 ${
        !hardwareConnected ? 'border-gray-500/30 opacity-60' : 'border-white/10'
      }`}>
        <p className="text-xs text-mac-textSecondary mb-3 font-medium uppercase tracking-wider">
          環境噪音
        </p>
        <div className="flex items-center gap-3">
          <Volume2 className={`w-5 h-5 ${hardwareConnected ? 'text-mac-textSecondary' : 'text-gray-500'}`} />
          <div className="flex-1">
            {!hardwareConnected ? (
              <div className="text-center py-2">
                <p className="text-sm text-gray-400">麥克風未連接</p>
              </div>
            ) : (
              <>
                <div className="relative h-2 w-full rounded-full overflow-hidden bg-white/10">
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full ${noiseConfig.color.split(' ')[0]}`}
                    style={{
                      width: `${displayDb}%`,
                      transitionProperty: 'width, background-color',
                      transitionDuration: '600ms',
                      transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className={`text-xs ${noiseConfig.color.split(' ')[1]} transition-colors duration-500`}>
                    {noiseConfig.label}
                  </span>
                  <span className={`text-sm font-semibold text-mac-textSecondary smooth-number ${
                    dbValueChanged ? 'value-update' : ''
                  }`}>
                    {Math.round(displayDb)} dB
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
