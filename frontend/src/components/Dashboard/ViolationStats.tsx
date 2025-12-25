import { ScanLine } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { MorphingNumber } from '@/components/ui/MorphingDigit'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'

interface ViolationStatsProps {
    todayViolationCount: number
}

export function ViolationStats({ todayViolationCount }: ViolationStatsProps) {
    const { t } = useLanguage()
    const isViolation = todayViolationCount > 0

    return (
        <Card className={cn(
            "border-white/10 bg-cyber-bg/80 backdrop-blur-xl overflow-hidden transition-all duration-500",
            isViolation ? "border-neon-red/30 shadow-[0_0_15px_rgba(255,0,60,0.15)]" : ""
        )}>
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-lg transition-colors duration-300",
                        isViolation ? "bg-neon-red/10 text-neon-red" : "bg-white/5 text-cyber-muted"
                    )}>
                        <ScanLine className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xs font-mono uppercase tracking-widest text-cyber-muted mb-1">
                            {t('statusPanel.todayViolations')}
                        </h3>
                        <div className={cn(
                            "text-2xl font-bold font-display tracking-tight flex items-baseline gap-1",
                            isViolation ? "text-neon-red drop-shadow-neon-red" : "text-white"
                        )}>
                            <MorphingNumber value={todayViolationCount} height={24} className="font-bold" />
                            <span className="text-sm font-normal text-white/50">{t('statusPanel.times')}</span>
                        </div>
                    </div>
                </div>

                {/* 額外的裝飾或狀態文字 */}
                <div className="text-right">
                    <div className={cn(
                        "px-2 py-1 rounded text-[10px] font-mono border",
                        isViolation
                            ? "bg-neon-red/10 border-neon-red/30 text-neon-red animate-pulse"
                            : "bg-white/5 border-white/10 text-cyber-muted"
                    )}>
                        {isViolation ? t('statusPanel.accumulatedPenalty') : t('statusPanel.statusGood')}
                    </div>
                </div>
            </CardContent>
            {/* 掃描線特效 (僅在有違規時顯示) */}
            {
                isViolation && (
                    <div className="absolute inset-0 pointer-events-none bg-scanline opacity-10" />
                )
            }
        </Card >
    )
}
