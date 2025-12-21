import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface PenaltyStep {
  id: string
  label: string
  status: 'pending' | 'in-progress' | 'completed' | 'error'
}

interface PenaltyProgressProps {
  isExecuting: boolean
  currentStep?: string
}

export function PenaltyProgress({ isExecuting, currentStep }: PenaltyProgressProps) {
  const [steps, setSteps] = useState<PenaltyStep[]>([
    { id: 'auth', label: '正在登入帳號', status: 'pending' },
    { id: 'prepare', label: '準備懲罰內容', status: 'pending' },
    { id: 'upload_image', label: '上傳人質照片', status: 'pending' },
    { id: 'post', label: '發布羞辱貼文', status: 'pending' },
    { id: 'email', label: '發送道歉郵件', status: 'pending' },
    { id: 'complete', label: '執行完成', status: 'pending' },
  ])

  useEffect(() => {
    if (!isExecuting) {
      // Reset all steps when not executing
      setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })))
      return
    }

    // Update step status based on currentStep
    setSteps(prev => {
      const currentIndex = prev.findIndex(s => s.id === currentStep)
      return prev.map((step, index) => {
        if (index < currentIndex) {
          return { ...step, status: 'completed' }
        } else if (index === currentIndex) {
          return { ...step, status: 'in-progress' }
        } else {
          return { ...step, status: 'pending' }
        }
      })
    })
  }, [isExecuting, currentStep])

  if (!isExecuting) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="glass rounded-3xl p-8 max-w-md w-full shadow-mac-lg animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neon-red/20 mb-4 animate-pulse-glow">
            <Loader2 className="w-8 h-8 text-neon-red animate-spin" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">懲罰協定執行中</h2>
          <p className="text-mac-textSecondary text-sm">
            正在執行社交羞辱制裁...
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                step.status === 'in-progress'
                  ? 'bg-mac-accent/10 scale-105'
                  : step.status === 'completed'
                  ? 'bg-neon-green/10'
                  : 'bg-white/5'
              }`}
            >
              <div className="flex-shrink-0">
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-6 h-6 text-neon-green animate-scale-in" />
                )}
                {step.status === 'in-progress' && (
                  <Loader2 className="w-6 h-6 text-mac-accent animate-spin" />
                )}
                {step.status === 'pending' && (
                  <Circle className="w-6 h-6 text-mac-textSecondary/30" />
                )}
                {step.status === 'error' && (
                  <Circle className="w-6 h-6 text-neon-red" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium transition-colors ${
                    step.status === 'in-progress'
                      ? 'text-mac-accent'
                      : step.status === 'completed'
                      ? 'text-neon-green'
                      : step.status === 'error'
                      ? 'text-neon-red'
                      : 'text-mac-textSecondary'
                  }`}
                >
                  {step.label}
                </p>
              </div>

              <div className="flex-shrink-0">
                <span className="text-xs text-mac-textSecondary">
                  {step.status === 'completed' && '✓'}
                  {step.status === 'in-progress' && `${index + 1}/${steps.length}`}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-mac-textSecondary">
            <span>懲罰執行進度</span>
            <span>
              {steps.filter(s => s.status === 'completed').length} / {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-red to-mac-accent transition-all duration-500 ease-out"
              style={{
                width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
