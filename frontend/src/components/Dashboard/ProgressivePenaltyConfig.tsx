/**
 * 階段性懲罰配置面板 (ProgressivePenaltyConfig)
 * 允許使用者設定不同違規次數對應的平台觸發規則。
 * 例如：第一次違規只發 Discord，第二次再加 Gmail。
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
    TrendingUp,
    Plus,
    Trash2,
    AlertTriangle
} from 'lucide-react'
import { DiscordIcon, GmailIcon } from '@/components/Icons'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProgressivePenaltyRule } from '@/hooks/useSocket'
import { useLanguage } from '@/context/LanguageContext'

// 重新匯出供其他模組使用（向後相容）
export type { ProgressivePenaltyRule }

interface ProgressivePenaltyConfigProps {
    rules: ProgressivePenaltyRule[]
    onRulesChange: (rules: ProgressivePenaltyRule[]) => void
    availablePlatforms: string[]  // 已設定憑證的平台
    isSessionActive?: boolean     // 專注中禁止修改
}

// 平台圖示對應
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    discord: <DiscordIcon className="w-4 h-4" />,
    gmail: <GmailIcon className="w-4 h-4" />,
}

const PLATFORM_LABELS: Record<string, string> = {
    discord: 'Discord',
    gmail: 'Gmail',
}

// 預設規則
const DEFAULT_RULES: ProgressivePenaltyRule[] = [
    { violationCount: 1, platforms: ['discord'] },
    { violationCount: 2, platforms: ['discord', 'gmail'] },
]

export function ProgressivePenaltyConfig({
    rules,
    onRulesChange,
    availablePlatforms,
    isSessionActive = false,
}: ProgressivePenaltyConfigProps) {
    const { t } = useLanguage()
    // 本地狀態管理編輯中的規則
    const [localRules, setLocalRules] = useState<ProgressivePenaltyRule[]>(
        rules.length > 0 ? rules : DEFAULT_RULES
    )

    // 當外部規則變更時同步
    useEffect(() => {
        if (rules.length > 0) {
            setLocalRules(rules)
        }
    }, [rules])

    // 新增規則
    const handleAddRule = () => {
        const maxViolation = Math.max(...localRules.map(r => r.violationCount), 0)
        const newRule: ProgressivePenaltyRule = {
            violationCount: maxViolation + 1,
            platforms: availablePlatforms.slice(0, 1), // 預設選第一個可用平台
        }
        const updatedRules = [...localRules, newRule].sort((a, b) => a.violationCount - b.violationCount)
        setLocalRules(updatedRules)
        onRulesChange(updatedRules)
    }

    // 刪除規則
    const handleDeleteRule = (index: number) => {
        const updatedRules = localRules.filter((_, i) => i !== index)
        setLocalRules(updatedRules)
        onRulesChange(updatedRules)
    }

    // 切換平台
    const handleTogglePlatform = (ruleIndex: number, platformId: string) => {
        const updatedRules = [...localRules]
        const rule = updatedRules[ruleIndex]

        if (rule.platforms.includes(platformId)) {
            rule.platforms = rule.platforms.filter(p => p !== platformId)
        } else {
            rule.platforms = [...rule.platforms, platformId]
        }

        setLocalRules(updatedRules)
        onRulesChange(updatedRules)
    }

    // 如果沒有可用平台，顯示提示
    if (availablePlatforms.length === 0) {
        return (
            <Card className="mac-card border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-neon-yellow" />
                        <span>{t('progressivePenalty.title')}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <p className="text-sm text-yellow-300">
                            {t('progressivePenalty.noPlatforms')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="mac-card border-white/10">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-neon-yellow" />
                    <span>{t('progressivePenalty.title')}</span>
                    {isSessionActive && (
                        <span className="text-xs px-2 py-0.5 bg-neon-red/20 text-neon-red rounded-full ml-auto">
                            {t('progressivePenalty.activeSession')}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs text-mac-textSecondary mb-4">
                    {t('progressivePenalty.description')}
                </p>

                {/* 規則列表 */}
                <div className="space-y-3">
                    <AnimatePresence>
                        {localRules.map((rule, index) => (
                            <motion.div
                                key={`rule-${index}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-neon-yellow">
                                            {rule.violationCount}
                                        </span>
                                        <span className="text-sm text-mac-textSecondary">
                                            {index === localRules.length - 1 ? t('progressivePenalty.violationCountPlus') : t('progressivePenalty.violationCount')}
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteRule(index)}
                                        disabled={isSessionActive || localRules.length <= 1}
                                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* 平台選擇 */}
                                <div className="flex flex-wrap gap-2">
                                    {availablePlatforms.map((platformId) => {
                                        const isSelected = rule.platforms.includes(platformId)
                                        return (
                                            <div
                                                key={platformId}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all interactive ${isSelected
                                                    ? 'bg-neon-green/20 border border-neon-green/50'
                                                    : 'bg-white/5 border border-white/10 hover:border-white/20'
                                                    } ${isSessionActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                onClick={() => !isSessionActive && handleTogglePlatform(index, platformId)}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    disabled={isSessionActive}
                                                    className="data-[state=checked]:bg-neon-green"
                                                />
                                                {PLATFORM_ICONS[platformId]}
                                                <Label className="text-xs cursor-pointer">
                                                    {PLATFORM_LABELS[platformId] || platformId}
                                                </Label>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* 新增規則按鈕 */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddRule}
                    disabled={isSessionActive}
                    className="w-full border-dashed border-white/20 text-mac-textSecondary hover:text-white hover:border-white/40"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('progressivePenalty.addRule')}
                </Button>

                {/* 說明提示 */}
                <div className="pt-3 border-t border-white/10">
                    <p className="text-[10px] text-mac-textSecondary">
                        {t('progressivePenalty.tip')}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
