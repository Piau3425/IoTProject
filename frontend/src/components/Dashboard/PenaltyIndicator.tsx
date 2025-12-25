/**
 * 處罰指示器 (PenaltyIndicator)
 * 當發生違規時，在螢幕頂部居中顯示當前的處罰狀態。
 */
import { motion, AnimatePresence } from 'framer-motion'
import { PenaltyLevel } from '@/hooks/useSocket'
import { cn } from '@/lib/utils'

interface PenaltyIndicatorProps {
    penaltyLevel: PenaltyLevel  // 當前處罰狀態 (NONE, PENALTY)
}

import { useLanguage } from '@/context/LanguageContext'

// ... imports

export function PenaltyIndicator({ penaltyLevel }: PenaltyIndicatorProps) {
    const { t } = useLanguage()

    /**
     * 針對不同處罰狀態的配置：包含顏色、標籤、圖示、背景與發光特效。
     */
    const levelConfig: Record<PenaltyLevel, {
        color: string
        label: string
        icon: string
        bg: string
        glow: string
    }> = {
        NONE: {
            color: 'text-white/50',
            label: t('penaltyIndicator.normal'),
            icon: '✓',
            bg: 'bg-white/5',
            glow: ''
        },
        PENALTY: {
            color: 'text-red-500',
            label: t('penaltyIndicator.penaltyExecuting'),
            icon: '●',
            bg: 'bg-red-500/20',
            glow: 'shadow-[0_0_20px_rgba(239,68,68,0.7)]'
        }
    }

    const config = levelConfig[penaltyLevel]
    const isActive = penaltyLevel !== 'NONE'

    return (
        <AnimatePresence>
            {/* 僅在有違規發生時（等級非 NONE）顯示指示器 */}
            {isActive && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    style={{ willChange: 'transform, opacity' }}
                    className={cn(
                        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
                        "px-6 py-3 rounded-lg border",
                        config.bg, config.glow,
                        "border-white/10 backdrop-blur-md"
                    )}
                >
                    <div className="flex items-center gap-4">
                        {/* 等級圖示 */}
                        <span
                            className="text-2xl animate-pulse-scale"
                            style={{ willChange: 'transform' }}
                        >
                            {config.icon}
                        </span>

                        {/* 狀態文字 */}
                        <div className="flex flex-col">
                            <span className={`font-bold text-sm ${config.color}`}>
                                {config.label}
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

