import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTimeWithHours } from '@/lib/utils'
import { Play, Square, AlertTriangle, Pause, PlayCircle } from 'lucide-react'
import { HostageManager } from './HostageManager'
import { useAudio } from '@/hooks/useAudio'

interface TimerProps {
  session: {
    status: string
    duration_minutes: number
    start_time: string | null
    violations: number
    paused_at?: string | null  // v1.0: Track pause time
    total_paused_seconds?: number  // v1.0: Total time spent paused
  } | null
  onStart: (minutes: number) => void
  onStop: () => void
  onPause?: () => void  // v1.0: Pause callback
  onResume?: () => void  // v1.0: Resume callback
  penaltyTriggered: boolean
  prepareRemainingMs?: number  // v1.0: Preparation countdown
}

export function Timer({ session, onStart, onStop, onPause, onResume, penaltyTriggered, prepareRemainingMs = 0 }: TimerProps) {
  const [duration, setDuration] = useState(25)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(25)
  const { play } = useAudio()

  const handleStart = useCallback(() => {
    play('start')
    onStart(duration)
  }, [duration, onStart, play])

  useEffect(() => {
    if (penaltyTriggered) {
      play('penalty')
    }
  }, [penaltyTriggered, play])

  useEffect(() => {
    if (session?.status === 'ACTIVE' && session.start_time) {
      const startTime = new Date(session.start_time).getTime()
      const endTime = startTime + session.duration_minutes * 60 * 1000

      const updateTimer = () => {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setRemainingSeconds(remaining)
        
        // Auto-complete session when timer reaches 0
        if (remaining === 0 && session.status === 'ACTIVE') {
          play('complete')
          setTimeout(() => {
            onStop()
          }, 1000)
        }
      }

      updateTimer()
      const interval = setInterval(updateTimer, 1000)
      return () => clearInterval(interval)
    } else {
      setRemainingSeconds(duration * 60)
    }
  }, [session, duration, play, onStop])

  const isActive = session?.status === 'ACTIVE'
  const isPaused = session?.status === 'PAUSED'  // v1.0: Paused state
  const isViolated = session?.status === 'VIOLATED'
  const isPreparing = prepareRemainingMs > 0  // v1.0: Preparation phase
  const progress = isActive 
    ? ((session.duration_minutes * 60 - remainingSeconds) / (session.duration_minutes * 60)) * 100 
    : 0

  return (
    <div className="relative mac-card p-8 hover-lift group animate-fade-in">
      {/* Timer Display */}
      <div className="text-center mb-8">
        <h2 className="text-xs uppercase tracking-wider text-mac-textSecondary mb-3 font-medium transition-colors duration-300">
          {isPreparing ? `準備中... ${Math.ceil(prepareRemainingMs / 1000)}秒` : 
           isActive ? '剩餘時間' : 
           isPaused ? '已暫停' :
           isViolated ? '偵測到違規行為' : '專注時長'}
        </h2>
        {!isActive && isEditingDuration ? (
          <div className="flex flex-col items-center gap-6 py-8 animate-scale-in">
            <div className="flex items-center gap-6">
              <Input
                type="number"
                value={hours}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setHours(Math.max(0, Math.min(23, val)))
                }}
                onWheel={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const delta = e.deltaY > 0 ? -1 : 1
                  setHours(prev => Math.max(0, Math.min(23, prev + delta)))
                }}
                className="w-40 text-center text-6xl font-light tracking-tight py-8 bg-white/5 border-mac-accent/50 focus:border-mac-accent text-white transition-all duration-400 hover:bg-white/10"
                min={0}
                max={23}
              />
              <span className="text-6xl text-white">:</span>
              <Input
                type="number"
                value={minutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setMinutes(Math.max(0, Math.min(59, val)))
                }}
                onWheel={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const delta = e.deltaY > 0 ? -1 : 1
                  setMinutes(prev => Math.max(0, Math.min(59, prev + delta)))
                }}
                className="w-40 text-center text-6xl font-light tracking-tight py-8 bg-white/5 border-mac-accent/50 focus:border-mac-accent text-white transition-all duration-400 hover:bg-white/10"
                min={0}
                max={59}
              />
            </div>
            <div className="flex gap-6 mt-4">
              <Button 
                onClick={() => {
                  setDuration(hours * 60 + minutes)
                  setIsEditingDuration(false)
                }}
                className="px-8 py-4 text-lg transition-all duration-300 hover:scale-105"
              >
                確認
              </Button>
              <Button 
                variant="outline"
                onClick={() => setIsEditingDuration(false)}
                className="px-8 py-4 text-lg transition-all duration-300 hover:scale-105"
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className={`timer-display smooth-number text-8xl font-light tracking-tight transition-all duration-500 ease-luxury ${
              isPreparing
                ? 'text-neon-yellow glow-yellow animate-pulse'
                : isViolated 
                ? 'text-neon-red glow-red animate-pulse-glow' 
                : isPaused
                ? 'text-neon-blue glow-blue'
                : isActive 
                ? 'text-neon-green glow-green' 
                : 'text-white cursor-pointer hover:text-mac-accent hover:scale-105'
            }`}
            onClick={() => {
              if (!isActive && !isPaused) {
                setHours(Math.floor(duration / 60))
                setMinutes(duration % 60)
                setIsEditingDuration(true)
              }
            }}
          >
            {isActive || isViolated || isPaused ? formatTimeWithHours(remainingSeconds) : `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`}
          </div>
        )}
        
        {/* Progress Bar with macOS style */}
        <div className="mt-6 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className={`h-full transition-all duration-700 ease-out ${
              isViolated 
                ? 'bg-gradient-to-r from-neon-red to-neon-orange' 
                : 'bg-gradient-to-r from-neon-green to-mac-accent'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {session?.violations ? (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-red/10 border border-neon-red/30 animate-slide-down">
            <AlertTriangle className="w-4 h-4 text-neon-red animate-bounce-subtle" />
            <span className="text-neon-red text-sm font-medium">
              違規次數：{session.violations}
            </span>
          </div>
        ) : null}
      </div>



      {/* Hostage Manager (only when not active) */}
      {!isActive && (
        <div className="mb-6 animate-slide-up">
          <HostageManager disabled={isActive} />
        </div>
      )}

      {/* Control Buttons with macOS style */}
      <div className="flex gap-4 justify-center w-full">
        {!isActive && !isPaused ? (
          <Button 
            size="lg" 
            onClick={handleStart}
            className="group relative w-full sm:w-auto px-12 py-6 bg-gradient-to-r from-mac-accent to-neon-blue text-white font-semibold text-lg rounded-xl shadow-glow-blue hover:shadow-glow-blue hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Play className="w-5 h-5 transition-transform group-hover:scale-110 duration-300" />
              啟動專注協定
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-neon-blue to-mac-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>
        ) : (
          <div className="flex gap-4 w-full sm:w-auto justify-center">
            {/* v1.0: Pause/Resume Button */}
            {isActive && onPause && (
              <Button 
                size="lg" 
                onClick={onPause}
                className="px-8 py-6 bg-gradient-to-r from-neon-blue to-mac-accent text-white font-semibold text-lg rounded-xl shadow-glow-blue hover:shadow-glow-blue hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <Pause className="mr-2 h-5 w-5" />
                暫停
              </Button>
            )}
            {isPaused && onResume && (
              <Button 
                size="lg" 
                onClick={onResume}
                className="px-8 py-6 bg-gradient-to-r from-neon-green to-mac-accent text-white font-semibold text-lg rounded-xl shadow-glow-green hover:shadow-glow-green hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                繼續
              </Button>
            )}
            {/* Stop Button */}
            <Button 
              size="lg" 
              onClick={onStop}
              className="px-8 py-6 bg-gradient-to-r from-neon-red to-neon-orange text-white font-semibold text-lg rounded-xl shadow-glow-red hover:shadow-glow-red hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <Square className="mr-2 h-5 w-5" />
              終止協定
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
