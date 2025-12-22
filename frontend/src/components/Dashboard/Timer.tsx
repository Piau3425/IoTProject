import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTimeWithHours } from '@/lib/utils'
import { Play, Square, AlertTriangle, Pause, PlayCircle, Clock, Aperture } from 'lucide-react'
import { HostageManager } from './HostageManager'
import { useAudio } from '@/hooks/useAudio'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemLock } from '@/hooks/usePhysics'
import { cn } from '@/lib/utils'
import gsap from 'gsap'

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
  const cardRef = useRef<HTMLDivElement>(null)
  const apertureRef = useRef<HTMLDivElement>(null)

  const isActive = session?.status === 'ACTIVE'
  const isPaused = session?.status === 'PAUSED'
  const isViolated = session?.status === 'VIOLATED'
  const isPreparing = prepareRemainingMs > 0

  // Apply system lock effect when active
  useSystemLock(cardRef, isActive);

  // Smooth Progress Animation
  useEffect(() => {
    let animationFrameId: number;

    const updateProgress = () => {
      if (session?.status === 'ACTIVE' && session.start_time) {
        const startTime = new Date(session.start_time).getTime();
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000;
        const durationMs = session.duration_minutes * 60 * 1000;
        const endTime = startTime + durationMs + totalPausedMs;
        const now = Date.now();

        const remainingMs = Math.max(0, endTime - now);
        const totalDurationMs = durationMs;
        const elapsedMs = totalDurationMs - remainingMs;
        
        // Calculate percentage (0 to 100)
        const newProgress = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
        setSmoothProgress(newProgress);

        if (remainingMs > 0) {
          animationFrameId = requestAnimationFrame(updateProgress);
        }
      }
    };

    if (isActive) {
      updateProgress();
    } else if (!isActive && !isPaused) {
      setSmoothProgress(0);
    } else if (isPaused && session?.start_time) {
       // Calculate static progress when paused
        const startTime = new Date(session.start_time).getTime();
        const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : Date.now();
        const totalPausedMs = (session.total_paused_seconds || 0) * 1000;
        const durationMs = session.duration_minutes * 60 * 1000;
        
        // Effective elapsed time before pause
        // elapsed = pausedAt - startTime - totalPausedMs (excluding current pause duration if it was included in totalPausedMs, but usually totalPausedMs is previous pauses)
        // Actually, simpler:
        // The session logic in backend might handle total_paused_seconds differently.
        // Let's assume standard logic:
        // elapsed = (pausedAt - startTime) - (previous_pauses)
        // But here we can just use the remainingSeconds logic from the other effect or recalculate.
        // Let's just use the remainingSeconds for paused state to be consistent with the text.
        // Or better, recalculate:
        const elapsedRaw = pausedAt - startTime;
        const effectiveElapsed = elapsedRaw - totalPausedMs;
        const newProgress = Math.min(100, Math.max(0, (effectiveElapsed / durationMs) * 100));
        setSmoothProgress(newProgress);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, isPaused, session]);

  // Aperture Lock Animation
  useEffect(() => {
    if (!apertureRef.current) return;

    if (isActive) {
      gsap.to(apertureRef.current, {
        scale: 1,
        opacity: 1,
        rotation: 180,
        duration: 1.5,
        ease: "expo.out"
      });
    } else {
      gsap.to(apertureRef.current, {
        scale: 1.5,
        opacity: 0,
        rotation: 0,
        duration: 1,
        ease: "power2.in"
      });
    }
  }, [isActive]);

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
      const totalPausedMs = (session.total_paused_seconds || 0) * 1000
      const endTime = startTime + session.duration_minutes * 60 * 1000 + totalPausedMs

      const updateTimer = () => {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setRemainingSeconds(remaining)
        
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
    } else if (session?.status === 'PAUSED' && session.start_time) {
      const startTime = new Date(session.start_time).getTime()
      const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : Date.now()
      const totalPausedMs = (session.total_paused_seconds || 0) * 1000
      const endTime = startTime + session.duration_minutes * 60 * 1000 + totalPausedMs
      const remaining = Math.max(0, Math.floor((endTime - pausedAt) / 1000))
      setRemainingSeconds(remaining)
    } else {
      setRemainingSeconds(duration * 60)
    }
  }, [session, duration, play, onStop])

  return (
    <Card ref={cardRef} className="relative overflow-hidden border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-700 min-h-[500px] flex flex-col justify-between">
      
      {/* Fluid Backdrop & Aperture Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Aperture Ring */}
        <div 
          ref={apertureRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[40px] border-neon-green/5 rounded-full opacity-0"
          style={{ transformOrigin: "center center" }}
        >
          <div className="absolute inset-0 border-[2px] border-neon-green/20 rounded-full animate-pulse" />
        </div>
        
        {/* Fluid Gradient */}
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            isActive ? "opacity-30" : "opacity-0"
          )}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${
              isViolated ? 'rgba(255, 59, 48, 0.2)' : 'rgba(52, 199, 89, 0.1)'
            }, transparent 70%)`,
            filter: "blur(40px)"
          }}
        />
      </div>

      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-mac-textSecondary uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" />
            專注會話控制
          </CardTitle>
          {isActive && (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20 text-[10px] text-neon-green animate-pulse">
              <Aperture className="w-3 h-3 animate-spin-slow" />
              <span>執行中</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-8 relative z-10 flex-1 flex flex-col justify-center">
        {/* Timer Display */}
        <div className="text-center mb-8">
          <h2 className={cn(
            "text-xs uppercase tracking-wider mb-3 font-medium transition-colors duration-300",
            isPreparing ? "text-neon-yellow" :
            isViolated ? "text-neon-red" :
            isActive ? "text-neon-green" : "text-mac-textSecondary"
          )}>
            {isPreparing ? `系統武裝中... ${Math.ceil(prepareRemainingMs / 1000)}s` : 
             isActive ? '剩餘時間' : 
             isPaused ? '會話暫停' :
             isViolated ? '偵測到違規' : '設定時長'}
          </h2>

          {isEditingDuration ? (
            <div className="flex items-center justify-center gap-4 animate-scale-in">
              <div className="flex flex-col items-center">
                <Input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 h-24 text-6xl text-center bg-white/5 border-white/10 focus:border-mac-accent focus:ring-mac-accent/20 rounded-2xl"
                />
                <span className="text-xs text-mac-textSecondary mt-2">小時</span>
              </div>
              <span className="text-6xl text-white/20 pb-8">:</span>
              <div className="flex flex-col items-center">
                <Input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 h-24 text-6xl text-center bg-white/5 border-white/10 focus:border-mac-accent focus:ring-mac-accent/20 rounded-2xl"
                />
                <span className="text-xs text-mac-textSecondary mt-2">分鐘</span>
              </div>
            </div>
          ) : (
            <div 
              className={cn(
                "text-8xl font-light tracking-tight transition-all duration-500 cursor-pointer select-none font-mono",
                isPreparing ? 'text-neon-yellow drop-shadow-[0_0_15px_rgba(255,255,0,0.5)]' :
                isViolated ? 'text-neon-red drop-shadow-[0_0_20px_rgba(255,0,0,0.6)]' :
                isPaused ? 'text-neon-blue opacity-70' :
                isActive ? 'text-neon-green drop-shadow-[0_0_15px_rgba(0,255,0,0.4)]' : 
                'text-white hover:text-mac-accent hover:scale-105'
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
                <AnimatedNumber 
                  value={remainingSeconds} 
                  format={formatTimeWithHours} 
                  className="justify-center"
                />
              ) : (
                `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
              )}
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-8 mx-8">
          <div 
            className={cn(
              "absolute top-0 left-0 h-full transition-none",
              isViolated ? 'bg-neon-red shadow-[0_0_10px_rgba(255,0,0,0.5)]' : 
              'bg-neon-green shadow-[0_0_10px_rgba(0,255,0,0.5)]'
            )}
            style={{ width: `${smoothProgress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {isEditingDuration ? (
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setDuration(hours * 60 + minutes)
                  setIsEditingDuration(false)
                }}
                className="bg-mac-accent hover:bg-mac-accentHover text-white px-8 py-6 rounded-xl text-lg font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-mac-accent/20"
              >
                確認
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditingDuration(false)}
                className="px-8 py-6 rounded-xl text-lg border-white/10 hover:bg-white/5 transition-all duration-300"
              >
                取消
              </Button>
            </div>
          ) : !isActive && !isPaused ? (
            <Button
              onClick={handleStart}
              disabled={isPreparing}
              className="group relative overflow-hidden !bg-white !text-black hover:!bg-white/90 px-12 py-8 rounded-2xl text-xl font-semibold transition-all duration-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              <span className="relative z-10 flex items-center gap-3">
                <PlayCircle className="w-6 h-6" />
                啟動專注協定
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>
          ) : (
            <div className="flex gap-4">
              {isPaused ? (
                <Button
                  onClick={onResume}
                  className="bg-neon-blue/20 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue/30 px-8 py-6 rounded-xl text-lg transition-all duration-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  繼續
                </Button>
              ) : (
                <Button
                  onClick={onPause}
                  className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 py-6 rounded-xl text-lg transition-all duration-300"
                >
                  <Pause className="w-5 h-5 mr-2" />
                  暫停
                </Button>
              )}
              
              <Button
                onClick={onStop}
                variant="destructive"
                className="bg-neon-red/20 text-neon-red border border-neon-red/50 hover:bg-neon-red/30 px-8 py-6 rounded-xl text-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,0,0,0.2)]"
              >
                <Square className="w-5 h-5 mr-2" />
                中止
              </Button>
            </div>
          )}
        </div>

        {/* Hostage Manager (File Upload) */}
        <div className="mt-8 pt-8 border-t border-white/5">
           <HostageManager 
             sessionActive={isActive} 
             onUploadComplete={(files) => console.log('Files uploaded:', files)}
           />
        </div>

        {session?.violations ? (
          <div className="mt-6 flex items-center justify-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/30 animate-slide-down">
            <AlertTriangle className="w-5 h-5 text-neon-red animate-bounce" />
            <span className="text-neon-red font-mono font-bold tracking-wider">
              偵測到違規次數: {session.violations}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
