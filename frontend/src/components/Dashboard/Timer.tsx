/**
 * 會話計時器組件 (Timer)
 * 系統的核心控制中心，負責顯示專注剩餘時間、進度條，以及處理會話的啟動、停止、暫停與恢復。
 * 具備細膩的視覺回饋（如違規閃爍特效、武裝中狀態）與音效觸發邏輯。
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseNumericInput } from '@/lib/utils'
import { Play, Square, Pause, Hourglass } from 'lucide-react'
import { HostageManager } from './HostageManager'
import { useAudio } from '@/hooks/useAudio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { MorphingDigit } from '@/components/ui/MorphingDigit'
import { useLanguage } from '@/context/LanguageContext'

interface TimerProps {
  session: {
    status: string
    duration_minutes: number
    start_time: string | null
    violations: number
    paused_at?: string | null
    total_paused_seconds?: number
  } | null
  onStart: (minutes: number) => void
  onStop: () => void
  onPause?: () => void
  onResume?: () => void
  penaltyTriggered: boolean    // 是否已觸發社交懲罰執行流程
  prepareRemainingMs?: number  // 武裝倒數計時（毫秒）
  isSensorViolated?: boolean   // 當前感測器是否偵測到違規行為
  hardwareReady?: boolean      // 硬體是否準備就緒 (連線或模擬模式)
  sensorsNormal?: boolean      // 感測器是否正常 (手機鎖定、人員在場、盒蓋關閉)
}

/**
 * 動畫時間顯示組件：將秒數轉換為 HH:MM:SS 或 MM:SS 格式並使用 MorphingNumber 實現數字翻轉動畫。
 */
/**
 * 時間片段組件：分別為每位數字加上動畫效果
 */
const TimeSegment = ({ value, padLength = 2 }: { value: number; padLength?: number }) => {
  const str = value.toString().padStart(padLength, '0')
  return (
    <div className="flex">
      {str.split('').map((digit, i) => (
        <MorphingDigit key={i} value={digit} height={96} forceDirection={-1} />
      ))}
    </div>
  )
}

const Separator = () => (
  <span className="opacity-60 mx-0.5">:</span>
)

/**
 * 動畫時間顯示組件：將秒數轉換為 HH:MM:SS 或 MM:SS 格式並使用 MorphingNumber 實現數字翻轉動畫。
 */
function AnimatedTimeDisplay({ seconds }: { seconds: number }) {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return (
      <div className="flex items-center">
        <TimeSegment value={hours} />
        <Separator />
        <TimeSegment value={mins} />
        <Separator />
        <TimeSegment value={secs} />
      </div>
    )
  }

  return (
    <div className="flex items-center">
      <TimeSegment value={mins} />
      <Separator />
      <TimeSegment value={secs} />
    </div>
  )
}

export function Timer({
  session,
  onStart,
  onStop,
  onPause,
  onResume,
  penaltyTriggered,
  prepareRemainingMs = 0,
  isSensorViolated = false,
  hardwareReady = false,
  sensorsNormal = true
}: TimerProps) {
  // 當前設定的目標時長
  const [duration, setDuration] = useState(25)
  // 即時剩餘秒數
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  // 是否處於編輯時長模式
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  // 編輯模式下的時、分輸入值
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(25)
  // 平滑進度百分比 (0-100)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const { play } = useAudio()
  const { t } = useLanguage()

  const isActive = session?.status === 'ACTIVE'
  const isPaused = session?.status === 'PAUSED'
  const isViolated = session?.status === 'VIOLATED'
  const isPreparing = prepareRemainingMs > 0

  // 用於處理滑鼠滾輪調整時間的 Input 引用
  const hourInputRef = useRef<HTMLInputElement>(null)
  const minuteInputRef = useRef<HTMLInputElement>(null)

  /**
   * 滾輪調整時間邏輯。
   * 允許使用者在時間輸入框上直接透過滾輪增減數值，提升使用者體驗。
   */
  useEffect(() => {
    const handleWheel = (e: WheelEvent, setter: React.Dispatch<React.SetStateAction<number>>) => {
      e.preventDefault()
      e.stopPropagation()
      // 依據滾輪方向決定加減（向上加，向下減）
      const step = e.deltaY > 0 ? -1 : 1
      setter(prev => Math.max(0, prev + step))
    }

    const hourInput = hourInputRef.current
    const minuteInput = minuteInputRef.current

    const hourHandler = (e: WheelEvent) => handleWheel(e, setHours)
    const minuteHandler = (e: WheelEvent) => handleWheel(e, setMinutes)

    if (hourInput) hourInput.addEventListener('wheel', hourHandler, { passive: false })
    if (minuteInput) minuteInput.addEventListener('wheel', minuteHandler, { passive: false })

    return () => {
      if (hourInput) hourInput.removeEventListener('wheel', hourHandler)
      if (minuteInput) minuteInput.removeEventListener('wheel', minuteHandler)
    }
  }, [isEditingDuration])

  // 控制違規時的紅光閃爍特效狀態
  const [showViolationEffect, setShowViolationEffect] = useState(false)

  /**
   * 偵測違規行為並決定是否維持閃爍特效。
   * 若違規狀態解除，會保留短暫的緩衝時間讓使用者注意到特效消失。
   */
  useEffect(() => {
    if (isViolated) {
      if (isSensorViolated) {
        setShowViolationEffect(true)
      } else {
        // 解除違規後延遲 1.5 秒再關閉特效，視覺感官更自然
        const hideTimer = setTimeout(() => setShowViolationEffect(false), 1500)
        return () => clearTimeout(hideTimer)
      }
    } else {
      setShowViolationEffect(false)
    }
  }, [isViolated, isSensorViolated])

  /**
   * 核心計時邏輯。
   * 透過 requestAnimationFrame 實現高頻率的剩餘時間計算，確保倒數與進度條移動絕對平滑。
   * 邏輯中考慮了後端傳來的「累積暫停時間」與「上次暫停時刻」，確保即便重新整理頁面計時也能精準同步。
   */
  useEffect(() => {
    let animationFrameId: number;

    const updateTimer = () => {
      // 效能優化：頁面不可見時暫停計算
      if (document.visibilityState === 'hidden') {
        animationFrameId = requestAnimationFrame(updateTimer)
        return
      }

      if (session?.status === 'ACTIVE' && session.start_time) {
        const startTime = new Date(session.start_time).getTime()
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000
        const durationMs = session.duration_minutes * 60 * 1000
        const endTime = startTime + durationMs + totalPausedMs
        const now = Date.now()

        const remainingMs = Math.max(0, endTime - now)
        const remainingSec = Math.floor(remainingMs / 1000)

        setRemainingSeconds(remainingSec)

        // 計算進度百分比
        const elapsedMs = durationMs - remainingMs
        const newProgress = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))
        setSmoothProgress(newProgress)

        animationFrameId = requestAnimationFrame(updateTimer)
      } else if (session?.status === 'PAUSED' && session.start_time) {
        // 暫停狀態：依據暫停的那一刻計算剩餘時間與進度
        const startTime = new Date(session.start_time).getTime()
        const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : Date.now()
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000
        const durationMs = session.duration_minutes * 60 * 1000

        const effectiveElapsed = (pausedAt - startTime) - totalPausedMs
        const remainingMs = Math.max(0, durationMs - effectiveElapsed)
        setRemainingSeconds(Math.floor(remainingMs / 1000))

        const newProgress = Math.min(100, Math.max(0, (effectiveElapsed / durationMs) * 100))
        setSmoothProgress(newProgress)
      } else {
        // 非會話狀態：回復到初始設定值
        setRemainingSeconds(duration * 60)
        setSmoothProgress(0)
      }
    }

    updateTimer()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [session, duration, isActive, isPaused])

  // 中止會話的回調，加入短暫延遲以防與音效播放衝突
  const stopSessionDelayed = useCallback(() => {
    setTimeout(() => {
      onStop()
    }, 1000)
  }, [onStop])

  // 當倒數歸零時播放完成音效並正式結束會話
  useEffect(() => {
    if (remainingSeconds === 0 && isActive) {
      play('complete')
      stopSessionDelayed()
    }
  }, [remainingSeconds, isActive, play, stopSessionDelayed])

  const handleStart = useCallback(() => {
    play('start')
    onStart(duration)
  }, [duration, onStart, play])

  // 當處罰機制正式執行時播放特定音效
  useEffect(() => {
    if (penaltyTriggered) {
      play('penalty')
    }
  }, [penaltyTriggered, play])

  return (
    <Card className="relative overflow-hidden border-white/10 bg-cyber-bg/80 backdrop-blur-2xl min-h-[500px] flex flex-col justify-between group">

      {/* 底部動態漸層光暈：根據當前系統狀態變換顏色（活動綠、違規紅、預設白） */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-20"
        animate={{
          background: isActive
            ? showViolationEffect
              ? 'radial-gradient(circle at 50% 50%, rgba(255, 0, 60, 0.3), transparent 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(0, 255, 159, 0.2), transparent 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05), transparent 70%)'
        }}
        transition={{ duration: 1 }}
      />

      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display font-medium text-cyber-muted uppercase tracking-widest flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-neon-blue" />
            <span>{t('timer.sessionControl')}</span>
          </CardTitle>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20 text-[10px] text-neon-green"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span>{t('timer.monitoring')}</span>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 flex-1 flex flex-col justify-center">
        {/* 計時器主顯示區域 */}
        <div className="text-center mb-8 relative">
          <motion.h2
            layout
            className={cn(
              "text-xs font-mono uppercase tracking-widest mb-4 transition-colors",
              isPreparing ? "text-neon-yellow" :
                isViolated ? "text-neon-red" :
                  isActive ? "text-neon-green" : "text-cyber-muted"
            )}
          >
            {isPreparing ? `${t('timer.arming')} ${Math.ceil(prepareRemainingMs / 1000)}s` :
              isActive ? t('timer.remainingTime') :
                isPaused ? t('timer.sessionPaused') :
                  isViolated ? t('timer.violationDetected') : t('timer.setDuration')}
          </motion.h2>

          <AnimatePresence mode="wait">
            {isEditingDuration ? (
              // 編輯模式：展示時、分輸入框
              <motion.div
                key="editing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center gap-4"
              >
                <div className="flex flex-col items-center">
                  <Input
                    ref={hourInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={hours}
                    onChange={(e) => setHours(parseNumericInput(e.target.value))}
                    className="w-24 h-24 text-5xl font-mono text-center bg-white/5 border-white/10 focus:border-neon-blue focus:ring-neon-blue/20 rounded-xl"
                  />
                  <span className="text-xs text-cyber-muted mt-2">{t('timer.hours')}</span>
                </div>
                <span className="text-6xl text-white/20 pb-8 font-mono">:</span>
                <div className="flex flex-col items-center">
                  <Input
                    ref={minuteInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={minutes}
                    onChange={(e) => setMinutes(parseNumericInput(e.target.value))}
                    className="w-24 h-24 text-5xl font-mono text-center bg-white/5 border-white/10 focus:border-neon-blue focus:ring-neon-blue/20 rounded-xl"
                  />
                  <span className="text-xs text-cyber-muted mt-2">{t('timer.minutes')}</span>
                </div>
              </motion.div>
            ) : (
              // 顯示模式：展示大型倒數數字
              <motion.div
                key="display"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "text-8xl md:text-9xl font-mono font-light tracking-tighter cursor-pointer select-none tabular-nums",
                  isPreparing ? 'text-neon-yellow drop-shadow-neon-yellow' :
                    (isViolated && (isSensorViolated || showViolationEffect)) ? 'text-neon-red drop-shadow-neon-red animate-glitch' :
                      isPaused ? 'text-neon-blue/70' :
                        isActive ? 'text-neon-green drop-shadow-neon-green' :
                          'text-white hover:text-neon-blue hover:scale-105 transition-transform'
                )}
                onClick={() => {
                  if (!isActive && !isPaused) {
                    setHours(Math.floor(duration / 60))
                    setMinutes(duration % 60)
                    setIsEditingDuration(true)
                  }
                }}
              >
                {isActive || isViolated || isPaused ? (
                  <div className="flex justify-center items-center font-mono">
                    <AnimatedTimeDisplay seconds={remainingSeconds} />
                  </div>
                ) : (
                  `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 線性進度條：視覺呈現任務剩餘長度 */}
          {isActive && (
            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto mt-6">
              <motion.div
                className={cn("h-full", isViolated ? "bg-neon-red shadow-[0_0_10px_rgba(255,0,60,0.5)]" : "bg-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]")}
                initial={{ width: 0 }}
                animate={{ width: `${smoothProgress}%` }}
                transition={{ ease: "linear", duration: 0.5 }}
              />
            </div>
          )}
        </div>

        {/* 下方控制按鈕區 */}
        <div className="flex justify-center gap-4">
          <AnimatePresence mode="wait">
            {isEditingDuration ? (
              <motion.div key="edit-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
                <Button
                  onClick={() => {
                    setDuration(hours * 60 + minutes)
                    setIsEditingDuration(false)
                  }}
                  className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold px-8 py-6 rounded-xl text-lg transition-all"
                >
                  {t('common.confirm')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingDuration(false)}
                  className="px-8 py-6 rounded-xl text-lg border-white/10 hover:bg-white/5"
                >
                  {t('common.cancel')}
                </Button>
              </motion.div>
            ) : !isActive && !isPaused ? (
              // 處於空閒狀態時展示「啟動」
              <motion.div key="start-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleStart}
                  disabled={isPreparing || !hardwareReady || !sensorsNormal}
                  data-cursor-skew="-10deg"
                  className="group relative overflow-hidden bg-white text-black hover:bg-white/90 px-16 py-8 rounded-none skew-x-[-10deg] text-xl font-bold transition-all hover:scale-105 hover:shadow-neon-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span className="relative z-10 flex items-center gap-3 skew-x-[10deg]">
                    <Play className="w-6 h-6 fill-current" />
                    {t('timer.startEnforcement')}
                  </span>
                </Button>
                {/* 無法啟動時顯示原因 */}
                {(!hardwareReady || !sensorsNormal) && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-neon-red font-mono"
                  >
                    {!hardwareReady ? t('timer.hardwareNotConnected') : t('timer.sensorAbnormal')}
                  </motion.p>
                )}
              </motion.div>
            ) : (
              // 執法中狀態展示「暫停」與「中止」
              <motion.div key="active-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
                {isPaused ? (
                  <Button
                    onClick={onResume}
                    className="bg-neon-blue/20 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue/30 px-8 py-6 rounded-xl text-lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {t('timer.resume')}
                  </Button>
                ) : (
                  <Button
                    onClick={onPause}
                    className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 py-6 rounded-xl text-lg"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    {t('timer.pause')}
                  </Button>
                )}

                <Button
                  onClick={onStop}
                  variant="destructive"
                  className="bg-neon-red/20 text-neon-red border border-neon-red/50 hover:bg-neon-red/30 px-8 py-6 rounded-xl text-lg"
                >
                  <Square className="w-5 h-5 mr-2" />
                  {t('timer.stop')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 羞辱素材管理器：管理即將被發布的照片/截圖 */}
        <div className="mt-8 pt-8 border-t border-white/5 px-4">
          <HostageManager />
        </div>

      </CardContent>
    </Card >
  )
}
