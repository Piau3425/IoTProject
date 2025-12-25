/**
 * 系統狀態面板 (StatusPanel)
 * 提供即時感測器數據的網格呈現，包含手機鎖定狀、人員存在感應、盒蓋狀態及環境噪音等級。
 * 採用賽博龐克風格的卡片設計，並利用動畫強化視覺回饋。
 */
import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  User,
  Volume2,
  Gauge,
  Cpu,
  Zap,
  ScanLine,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { MorphingNumber } from '@/components/ui/MorphingDigit';
import { useLanguage } from '@/context/LanguageContext';

// v1.0 硬體狀態機狀態
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
  radarDetected?: boolean
  hardwareState?: HardwareState
  irDetected?: boolean
  lcdDetected?: boolean
  personAwaySince?: string | null
  noiseStartTime?: string | null
  noiseThreshold?: number
  noiseDuration?: number
  sessionStatus?: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'VIOLATED' | 'COMPLETED'
}


/**
 * 定義不同狀態下的配色系統，用於視覺警告。
 */
const STATUS_COLORS = {
  active: "text-neon-green border-neon-green/30 bg-neon-green/5 shadow-[0_0_10px_rgba(0,255,159,0.1)]",
  inactive: "text-cyber-muted border-white/5 bg-white/5",
  warning: "text-neon-yellow border-neon-yellow/30 bg-neon-yellow/5",
  error: "text-neon-red border-neon-red/30 bg-neon-red/5 shadow-[0_0_10px_rgba(255,0,60,0.1)]"
} as const;

/**
 * 狀態模組組件：單一感測器數據的顯示方塊。
 */
const StatusModule = ({
  icon: Icon,
  label,
  value,
  status,
  subValue
}: {
  icon: React.ComponentType<{ className?: string }>,
  label: string,
  value: React.ReactNode,
  status: 'active' | 'inactive' | 'warning' | 'error',
  subValue?: string
}) => {

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      className={cn(
        "relative overflow-hidden rounded-md border p-4 transition-all duration-500 group hover:shadow-lg hover:border-opacity-50",
        STATUS_COLORS[status]
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-70">{label}</p>
          <div className="text-lg font-bold tracking-tight font-display">{value}</div>
          {subValue && <p className="text-[10px] uppercase tracking-wider opacity-60">{subValue}</p>}
        </div>
        <div className={cn(
          "rounded-sm p-2 transition-transform duration-300 group-hover:scale-110",
          status === 'active' ? "bg-neon-green/10 text-neon-green" :
            status === 'error' ? "bg-neon-red/10 text-neon-red" :
              "bg-white/5 text-cyber-muted"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* 針對活動狀態模組的掃描線特效 */}
      {status === 'active' && (
        <div className="absolute inset-0 pointer-events-none bg-scanline opacity-20" />
      )}

      {/* 四角裝飾線 */}
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-30" />
    </motion.div>
  );
};

/**
 * 具備變色邏輯的動態數字顯示組件。
 */
const AnimatedNumber = ({ value, threshold }: { value: number, threshold: number }) => {
  const isDanger = value > threshold;

  return (
    <div className={cn(
      "flex items-center gap-1",
      isDanger ? "text-neon-red drop-shadow-neon-red" : "text-white"
    )}>
      {/* 使用 MorphingNumber 實現數字滾動切換效果 */}
      <MorphingNumber
        value={value}
        precision={1}
        height={40}
        color="currentColor"
      />
    </div>
  );
};

export function StatusPanel({
  phoneStatus,
  presenceStatus,
  boxStatus,
  currentDb,
  hardwareConnected,
  isMock,
  hardwareBoard = 'D1-mini',
  nfcDetected = false,
  radarDetected = false,
  irDetected = false,
  hardwareState = 'IDLE',
  personAwaySince,
  noiseStartTime,
  noiseThreshold = 70,
  noiseDuration = 3,
  sessionStatus = 'IDLE',
}: StatusPanelProps) {
  const [awaySeconds, setAwaySeconds] = useState(0)
  const [noiseSeconds, setNoiseSeconds] = useState(0)
  const { t } = useLanguage()

  // 當偵測到使用者離開時，啟動前端秒數計時器
  useEffect(() => {
    if (presenceStatus === 'AWAY' && personAwaySince) {
      const interval = setInterval(() => {
        const start = new Date(personAwaySince).getTime()
        const now = Date.now()
        const diff = Math.floor((now - start) / 1000)
        setAwaySeconds(diff)
      }, 500)  // 降低更新頻率以節省 CPU
      return () => clearInterval(interval)
    } else {
      setAwaySeconds(0)
    }
  }, [presenceStatus, personAwaySince])

  // 當偵測到噪音時，啟動前端秒數計時器
  // 改進：僅依賴 noiseStartTime 是否存在來決定倒數狀態，避免 dB 值波動造成重置
  // 修正：僅在協定啟用 (ACTIVE) 時才進行噪音倒數計時
  useEffect(() => {
    if (noiseStartTime && sessionStatus === 'ACTIVE') {
      const interval = setInterval(() => {
        const start = new Date(noiseStartTime).getTime()
        const now = Date.now()
        // 使用 0.1 秒精度 (更新頻率已降低以節省資源)
        const diff = (now - start) / 1000
        setNoiseSeconds(diff)
      }, 500)  // 降低更新頻率以節省 CPU
      return () => clearInterval(interval)
    } else {
      setNoiseSeconds(0)
    }
  }, [noiseStartTime, sessionStatus])

  // 計算人員在場狀態的顯示文字
  const presenceText = presenceStatus === 'DETECTED' ? t('statusPanel.detected') :
    presenceStatus === 'AWAY' ? (
      awaySeconds > 10 ? (
        <div className="flex items-center gap-1 text-neon-red drop-shadow-neon-red">
          <span>{t('statusPanel.violation')}(</span>
          <MorphingNumber value={awaySeconds} height={20} className="font-bold" />
          <span>s)</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span>{t('statusPanel.away')}(</span>
          <MorphingNumber value={10 - awaySeconds} height={20} className="font-bold" />
          <span>s)</span>
        </div>
      )
    ) : t('statusPanel.unknownStatus')

  return (
    <Card className="border-white/10 bg-cyber-bg/80 backdrop-blur-xl overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-cyber-muted uppercase tracking-widest flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            {t('statusPanel.systemStatus')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* 連線狀態指示燈：使用 CSS 動畫代替 Framer Motion 以節省資源 */}
            <div
              className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                hardwareConnected ? "bg-neon-green shadow-neon-green" : "bg-neon-red shadow-neon-red"
              )}
            />
            <span className="text-xs font-mono text-cyber-muted">
              {hardwareConnected ? t('statusPanel.online') : t('statusPanel.offline')}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex flex-col">

        {/* 主要狀態網格 */}
        <motion.div
          className="grid grid-cols-2 gap-2"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          <StatusModule
            icon={Smartphone}
            label={t('statusPanel.phoneLockStatus')}
            value={phoneStatus === 'LOCKED' ? t('statusPanel.phoneLocked') : phoneStatus === 'REMOVED' ? t('statusPanel.phoneUnlocked') : t('statusPanel.unknownStatus')}
            status={phoneStatus === 'LOCKED' ? 'active' : phoneStatus === 'REMOVED' ? 'error' : 'inactive'}
            subValue={nfcDetected ? t('statusPanel.nfcDetected') : t('statusPanel.noSignal')}
          />

          <StatusModule
            icon={User}
            label={t('statusPanel.userPresence')}
            value={presenceText}
            status={presenceStatus === 'DETECTED' ? 'active' : presenceStatus === 'AWAY' ? (awaySeconds > 8 ? 'error' : 'warning') : 'inactive'}
            subValue={radarDetected ? t('statusPanel.radarLocked') : t('statusPanel.searching')}
          />

          <StatusModule
            icon={ScanLine}
            label={t('statusPanel.boxLidStatus')}
            value={boxStatus === 'OPEN' ? t('statusPanel.boxOpen') : boxStatus === 'CLOSED' ? t('statusPanel.boxClosed') : t('statusPanel.unknownStatus')}
            status={boxStatus === 'OPEN' ? 'error' : boxStatus === 'CLOSED' ? 'active' : 'inactive'}
            subValue={irDetected ? t('statusPanel.sensorConnected') : t('statusPanel.sensorOffline')}
          />

          <StatusModule
            icon={Zap}
            label={t('statusPanel.hardwareStatus')}
            value={isMock ? t('statusPanel.simulating') :
              hardwareState === 'IDLE' ? t('statusPanel.idle') :
                hardwareState === 'PREPARING' ? t('statusPanel.preparing') :
                  hardwareState === 'FOCUSING' ? t('statusPanel.focusing') :
                    hardwareState === 'PAUSED' ? t('statusPanel.paused') :
                      hardwareState === 'VIOLATION' ? t('statusPanel.violating') : t('statusPanel.error')}
            status={(isMock || hardwareState === 'FOCUSING') ? 'active' : 'inactive'}
            subValue={isMock ? t('statusPanel.simulatedData') : t('statusPanel.realHardware')}
          />


        </motion.div>

        {/* 環境音量等級區塊 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-md border border-white/10 bg-black/40 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyber-muted">{t('statusPanel.environmentVolume')}</span>
            <Volume2 className={cn(
              "h-4 w-4 transition-colors duration-300",
              currentDb >= noiseThreshold ? "text-neon-red" : "text-white"
            )} />
          </div>

          {/* 穩定顯示的 dB 數值區域 */}
          <div className="flex items-center gap-2">
            <AnimatedNumber value={currentDb} threshold={noiseThreshold} />
            <span className="text-sm font-mono text-cyber-muted">dB</span>

            {/* 動態顯示的狀態/倒數區域 - 移除動畫效果 */}
            <div className="relative h-6 flex items-center overflow-visible">
              <AnimatePresence mode="wait">
                {noiseSeconds > 0 ? (
                  noiseSeconds >= noiseDuration ? (
                    // 違規狀態
                    <motion.div
                      key="violation"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1 text-neon-red drop-shadow-neon-red ml-2"
                    >
                      <span className="text-xs font-bold font-display tracking-wider">{t('statusPanel.violation')}</span>
                      <div className="bg-neon-red/10 px-1.5 py-0.5 rounded border border-neon-red/30 flex items-center">
                        <span className="font-bold tabular-nums text-sm">{(noiseSeconds - noiseDuration).toFixed(1)}</span>
                        <span className="text-[10px] ml-0.5">s</span>
                      </div>
                    </motion.div>
                  ) : (
                    // 倒數狀態
                    <motion.div
                      key="countdown"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1 text-neon-yellow ml-2"
                    >
                      <span className="text-xs font-bold font-display tracking-wider">{t('statusPanel.warning')}</span>
                      <div className="bg-neon-yellow/10 px-1.5 py-0.5 rounded border border-neon-yellow/30 flex items-center">
                        <span className="font-bold tabular-nums text-sm">{Math.max(0, noiseDuration - noiseSeconds).toFixed(1)}</span>
                        <span className="text-[10px] ml-0.5">s</span>
                      </div>
                    </motion.div>
                  )
                ) : (
                  // 正常狀態
                  <motion.span
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-cyber-muted/50 ml-2"
                  >
                    ({t('statusPanel.normal')})
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* 硬體詳細資訊頁尾 */}
        <div className="pt-2 border-t border-white/5">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-cyber-muted/60">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span>{hardwareBoard}</span>
            </div>
            <div className="flex items-center gap-1">
              {hardwareConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{hardwareConnected ? t('statusPanel.connected') : t('statusPanel.connectionLost')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{isMock ? t('statusPanel.simulatedData') : t('statusPanel.realTimeData')}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card >
  );
}
