import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, Circle, Loader2, Ban } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export interface PenaltyStep {
  id: string
  label: string
  status: 'pending' | 'in-progress' | 'completed' | 'error'
}

interface PenaltyProgressProps {
  isExecuting: boolean
  currentStep?: string
  dynamicSteps: PenaltyStep[]  // 從父組件接收動態生成的步驟列表
}

export function PenaltyProgress({ isExecuting, currentStep, dynamicSteps }: PenaltyProgressProps) {
  const { t } = useLanguage()
  // 使用傳入的動態步驟作為初始狀態
  const [steps, setSteps] = useState<PenaltyStep[]>(
    dynamicSteps.map(s => ({ ...s }))
  )

  // 追蹤上一次的執行狀態，用於偵測 isExecuting 從 false 變為 true 的時刻
  const wasExecutingRef = useRef(false)
  // 緩存初始步驟列表，避免執行過程中因 dynamicSteps 變化而重置
  const initialStepsRef = useRef<PenaltyStep[]>([])

  // 當 isExecuting 從 false 變為 true 時，初始化步驟列表
  // 移除執行結束時的重置邏輯，讓步驟保持完成狀態直到下次懲罰開始時才重新初始化
  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      // 剛開始執行：緩存當前步驟並重置狀態
      initialStepsRef.current = dynamicSteps.map(s => ({ ...s, status: 'pending' as const }))
      setSteps(initialStepsRef.current)
    }
    // 不再於執行結束時重置，讓完成動畫可以正常顯示
    wasExecutingRef.current = isExecuting
  }, [isExecuting, dynamicSteps])

  // 根據 currentStep 更新步驟狀態（僅在執行中時生效）
  useEffect(() => {
    if (!isExecuting) return

    // 當收到完成標記時，將所有步驟標記為 completed
    if (currentStep === '_complete') {
      setSteps(prev => prev.map(step => ({ ...step, status: 'completed' as const })))
      return
    }

    // 根據 currentStep 更新步驟狀態
    // 使用函數式更新確保狀態正確
    setSteps(prev => {
      const currentIndex = prev.findIndex(s => s.id === currentStep)
      if (currentIndex === -1) return prev

      return prev.map((step, index) => {
        // 已完成的步驟保持完成狀態，不會被重置
        if (step.status === 'completed') {
          return step
        }
        if (index < currentIndex) {
          return { ...step, status: 'completed' as const }
        } else if (index === currentIndex) {
          return { ...step, status: 'in-progress' as const }
        } else {
          return { ...step, status: 'pending' as const }
        }
      })
    })
  }, [isExecuting, currentStep])

  if (!isExecuting) return null

  // 處理無任何步驟的情況：顯示「無需執行」提示
  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="glass rounded-3xl p-8 max-w-md w-full shadow-mac-lg animate-scale-in">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mac-textSecondary/20 mb-4">
              <Ban className="w-8 h-8 text-mac-textSecondary" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">{t('penaltyProgress.noPenaltyRequired')}</h2>
            <p className="text-mac-textSecondary text-sm">
              {t('penaltyProgress.noActionsConfigured')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="glass rounded-3xl p-8 max-w-md w-full shadow-mac-lg animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neon-red/20 mb-4 animate-pulse-glow">
            <Loader2 className="w-8 h-8 text-neon-red animate-spin" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">{t('penaltyProgress.executingSchema')}</h2>
          <p className="text-mac-textSecondary text-sm">
            {t('penaltyProgress.executingAction')}
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${step.status === 'in-progress'
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
                  className={`text-sm font-medium transition-colors ${step.status === 'in-progress'
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
            <span>{t('penaltyProgress.progress')}</span>
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
