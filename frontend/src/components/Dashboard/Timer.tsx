import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTimeWithHours } from '@/lib/utils'
import { Play, Square, AlertTriangle, Pause, Hourglass } from 'lucide-react'
import { HostageManager } from './HostageManager'
import { useAudio } from '@/hooks/useAudio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
  penaltyTriggered: boolean
  prepareRemainingMs?: number
}

export function Timer({ session, onStart, onStop, onPause, onResume, penaltyTriggered, prepareRemainingMs = 0 }: TimerProps) {
  const [duration, setDuration] = useState(25)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(25)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const { play } = useAudio()

  const isActive = session?.status === 'ACTIVE'
  const isPaused = session?.status === 'PAUSED'
  const isViolated = session?.status === 'VIOLATED'
  const isPreparing = prepareRemainingMs > 0

  // Smooth Progress & Timer Logic
  useEffect(() => {
    let animationFrameId: number;

    const updateTimer = () => {
      if (session?.status === 'ACTIVE' && session.start_time) {
        const startTime = new Date(session.start_time).getTime()
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000
        const durationMs = session.duration_minutes * 60 * 1000
        const endTime = startTime + durationMs + totalPausedMs
        const now = Date.now()

        const remainingMs = Math.max(0, endTime - now)
        const remainingSec = Math.floor(remainingMs / 1000)

        setRemainingSeconds(remainingSec)

        // Progress Calculation
        const elapsedMs = durationMs - remainingMs
        const newProgress = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))
        setSmoothProgress(newProgress)

        if (remainingMs === 0 && session.status === 'ACTIVE') {
          // Completion handled by simple check here, but better to trigger once.
          // Ideally parent handles stopping or we do it here.
        }

        animationFrameId = requestAnimationFrame(updateTimer)
      } else if (session?.status === 'PAUSED' && session.start_time) {
        // Paused state logic
        const startTime = new Date(session.start_time).getTime()
        const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : Date.now()
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000
        const durationMs = session.duration_minutes * 60 * 1000

        // Time remaining at moment of pause
        const effectiveElapsed = (pausedAt - startTime) - totalPausedMs
        const remainingMs = Math.max(0, durationMs - effectiveElapsed)
        setRemainingSeconds(Math.floor(remainingMs / 1000))

        // Progress at moment of pause
        const newProgress = Math.min(100, Math.max(0, (effectiveElapsed / durationMs) * 100))
        setSmoothProgress(newProgress)
      } else {
        setRemainingSeconds(duration * 60)
        setSmoothProgress(0)
      }
    }

    updateTimer()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [session, duration, isActive, isPaused])

  // Completion Sound Effect
  useEffect(() => {
    if (remainingSeconds === 0 && isActive) {
      play('complete')
      stopSessionDelayed()
    }
  }, [remainingSeconds, isActive, play])

  const stopSessionDelayed = useCallback(() => {
    // Debounce stop to allow sound to play
    setTimeout(() => {
      onStop()
    }, 1000)
  }, [onStop])

  const handleStart = useCallback(() => {
    play('start')
    onStart(duration)
  }, [duration, onStart, play])

  // Penalty Sound
  useEffect(() => {
    if (penaltyTriggered) {
      play('penalty')
    }
  }, [penaltyTriggered, play])

  return (
    <Card className="relative overflow-hidden border-white/10 bg-cyber-bg/80 backdrop-blur-2xl min-h-[500px] flex flex-col justify-between group">

      {/* Background Animated Gradient */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-20"
        animate={{
          background: isActive
            ? isViolated
              ? 'radial-gradient(circle at 50% 50%, rgba(255, 0, 60, 0.3), transparent 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(0, 255, 159, 0.2), transparent 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05), transparent 70%)'
        }}
        transition={{ duration: 1 }}
      />

      {/* Aperture / Ring Effect - Replaced GSAP with Framer Motion */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <motion.div
          className="w-[500px] h-[500px] rounded-full border-[1px] border-white/5"
          animate={{
            scale: isActive ? [1, 1.05, 1] : 0.8,
            opacity: isActive ? 1 : 0.2,
            rotate: isActive ? 360 : 0
          }}
          transition={{
            scale: { repeat: Infinity, duration: 4 },
            rotate: { repeat: Infinity, duration: 20, ease: "linear" }
          }}
        >
          {/* Inner Dashed Ring */}
          <div className="absolute inset-0 border-[1px] border-dashed border-white/10 rounded-full" />
        </motion.div>

        {/* Active Ring Indicators */}
        {isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={cn(
              "absolute w-[300px] h-[300px] rounded-full border-[2px]",
              isViolated ? "border-neon-red/30 shadow-neon-red" : "border-neon-green/30 shadow-neon-green"
            )}
          />
        )}
      </div>

      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display font-medium text-cyber-muted uppercase tracking-widest flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-neon-blue" />
            <span>會話控制協定</span>
          </CardTitle>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20 text-[10px] text-neon-green"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span>監控中</span>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 flex-1 flex flex-col justify-center">
        {/* Timer Display Area */}
        <div className="text-center mb-8">
          <motion.h2
            layout
            className={cn(
              "text-xs font-mono uppercase tracking-widest mb-4 transition-colors",
              isPreparing ? "text-neon-yellow" :
                isViolated ? "text-neon-red" :
                  isActive ? "text-neon-green" : "text-cyber-muted"
            )}
          >
            {isPreparing ? `系統武裝中... ${Math.ceil(prepareRemainingMs / 1000)}s` :
              isActive ? '剩餘時間' :
                isPaused ? '會話暫停' :
                  isViolated ? '偵測到違規' : '設定時長'}
          </motion.h2>

          <AnimatePresence mode="wait">
            {isEditingDuration ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center gap-4"
              >
                <div className="flex flex-col items-center">
                  <Input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                    onWheel={(e) => {
                      // Prevent page scroll and native input change
                      // e.preventDefault() might not work in React's passive event, 
                      // but checking logic: if we don't blur, we keep focus.
                      // Since React's onWheel is synthetic, we can't always prevent default if it's passive.
                      // However, inputs usually allow default prevention.
                      // IMPORTANT: do NOT blur, otherwise next scroll hits page.
                      e.stopPropagation()
                      const delta = Math.sign(e.deltaY) * -1
                      setHours(prev => Math.max(0, prev + delta))
                    }}
                    className="w-24 h-24 text-5xl font-mono text-center bg-white/5 border-white/10 focus:border-neon-blue focus:ring-neon-blue/20 rounded-xl"
                  />
                  <span className="text-xs text-cyber-muted mt-2">小時</span>
                </div>
                <span className="text-6xl text-white/20 pb-8 font-mono">:</span>
                <div className="flex flex-col items-center">
                  <Input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    onWheel={(e) => {
                      e.stopPropagation()
                      const delta = Math.sign(e.deltaY) * -1
                      setMinutes(prev => Math.max(0, prev + delta))
                    }}
                    className="w-24 h-24 text-5xl font-mono text-center bg-white/5 border-white/10 focus:border-neon-blue focus:ring-neon-blue/20 rounded-xl"
                  />
                  <span className="text-xs text-cyber-muted mt-2">分鐘</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="display"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "text-8xl md:text-9xl font-mono font-light tracking-tighter cursor-pointer select-none tabular-nums",
                  isPreparing ? 'text-neon-yellow drop-shadow-neon-yellow' :
                    isViolated ? 'text-neon-red drop-shadow-neon-red animate-glitch' :
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
                  <div className="flex justify-center font-mono">
                    {formatTimeWithHours(remainingSeconds)}
                  </div>
                ) : (
                  `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Bar (Cyber Style) */}
        <div className="relative h-1 bg-white/5 w-full max-w-md mx-auto mb-10 overflow-hidden">
          <motion.div
            className={cn(
              "absolute top-0 left-0 h-full",
              isViolated ? 'bg-neon-red shadow-neon-red' : 'bg-neon-green shadow-neon-green'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${smoothProgress}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />
        </div>

        {/* Controls */}
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
                  確認
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingDuration(false)}
                  className="px-8 py-6 rounded-xl text-lg border-white/10 hover:bg-white/5"
                >
                  取消
                </Button>
              </motion.div>
            ) : !isActive && !isPaused ? (
              <motion.div key="start-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button
                  onClick={handleStart}
                  disabled={isPreparing}
                  data-cursor-skew="-10deg"
                  className="group relative overflow-hidden bg-white text-black hover:bg-white/90 px-16 py-8 rounded-none skew-x-[-10deg] text-xl font-bold transition-all hover:scale-105 hover:shadow-neon-blue"
                >
                  <span className="relative z-10 flex items-center gap-3 skew-x-[10deg]">
                    <Play className="w-6 h-6 fill-current" />
                    啟動執法協定
                  </span>
                </Button>
              </motion.div>
            ) : (
              <motion.div key="active-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
                {isPaused ? (
                  <Button
                    onClick={onResume}
                    className="bg-neon-blue/20 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue/30 px-8 py-6 rounded-xl text-lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    繼續
                  </Button>
                ) : (
                  <Button
                    onClick={onPause}
                    className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 py-6 rounded-xl text-lg"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    暫停
                  </Button>
                )}

                <Button
                  onClick={onStop}
                  variant="destructive"
                  className="bg-neon-red/20 text-neon-red border border-neon-red/50 hover:bg-neon-red/30 px-8 py-6 rounded-xl text-lg"
                >
                  <Square className="w-5 h-5 mr-2" />
                  中止
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hostage Manager */}
        <div className="mt-8 pt-8 border-t border-white/5 px-4">
          <HostageManager
            sessionActive={isActive}
            onUploadComplete={(files) => console.log('Files uploaded:', files)}
          />
        </div>

        {/* Violation Alert Banner */}
        <AnimatePresence>
          {session?.violations ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 mx-4 overflow-hidden"
            >
              <div className="flex items-center justify-center gap-3 p-3 rounded-sm bg-neon-red/10 border border-neon-red/50 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-neon-red" />
                <span className="text-neon-red font-mono font-bold tracking-widest">
                  違規次數: {session.violations.toString().padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
