/**
 * 懲罰感測器配置面板 (PenaltyConfigPanel)
 * 允許使用者自定義哪些感測器的觸發會被計入違規。
 * 包含必選感測器（手機、盒蓋）與可選感測器（在位、噪音），
 * 並提供針對特定感測器的細節參數設定（如噪音分貝閾值、容錯秒數）。
 * 
 * v1.1 更新：將詳細設定整合到對應的感測器區塊內，提升可辨識性。
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { parseNumericInput } from '@/lib/utils'
import {
  Smartphone,
  User,
  Volume2,
  Box,
  ChevronDown,
} from 'lucide-react'
import { PenaltyConfig } from '@/hooks/useSocket'
import { PenaltyIcon } from '@/components/Icons'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'

interface PenaltyConfigPanelProps {
  config: PenaltyConfig
  onConfigChange: (config: PenaltyConfig) => void
  isSessionActive?: boolean // 執法中禁止修改配置
}

export function PenaltyConfigPanel({
  config,
  onConfigChange,
  isSessionActive = false,
}: PenaltyConfigPanelProps) {
  // 本地狀態儲存持續時間輸入值，避免輸入時由於驗證導致的文字跳動
  const [localNoiseDuration, setLocalNoiseDuration] = useState<string>(
    String(config.noise_duration_sec ?? 3)
  )
  const [localPresenceDuration, setLocalPresenceDuration] = useState<string>(
    String(config.presence_duration_sec ?? 10)
  )
  const { t } = useLanguage()

  // 當外部 config 變更時（如其他來源改變），同步本地狀態
  useEffect(() => {
    setLocalNoiseDuration(String(config.noise_duration_sec ?? 3))
  }, [config.noise_duration_sec])

  useEffect(() => {
    setLocalPresenceDuration(String(config.presence_duration_sec ?? 10))
  }, [config.presence_duration_sec])

  const handleToggle = (key: keyof PenaltyConfig, value: boolean) => {
    onConfigChange({
      ...config,
      [key]: value
    })
  }

  const handleThresholdChange = (value: number[]) => {
    onConfigChange({
      ...config,
      noise_threshold_db: value[0]
    })
  }

  // 靜態定義面板中展示的感測器項目
  const penalties = [
    {
      id: 'enable_phone_penalty',
      labelKey: 'penaltyConfig.phoneLock',
      descKey: 'penaltyConfig.phoneLockDesc',
      icon: Smartphone,
      color: 'text-blue-400',
      enabled: true,
      required: true
    },
    {
      id: 'enable_box_open_penalty',
      labelKey: 'penaltyConfig.boxClosed',
      descKey: 'penaltyConfig.boxClosedDesc',
      icon: Box,
      color: 'text-purple-400',
      enabled: true,
      required: true
    },
    {
      id: 'enable_presence_penalty',
      labelKey: 'penaltyConfig.presenceRequired',
      descKey: 'penaltyConfig.presenceRequiredDesc',
      icon: User,
      color: 'text-green-400',
      enabled: config.enable_presence_penalty,
      required: false,
      hasSettings: true,
      settingsType: 'presence'
    },
    {
      id: 'enable_noise_penalty',
      labelKey: 'penaltyConfig.quietEnvironment',
      descKey: 'penaltyConfig.quietEnvironmentDesc',
      icon: Volume2,
      color: 'text-yellow-400',
      enabled: config.enable_noise_penalty,
      required: false,
      hasSettings: true,
      settingsType: 'noise'
    }
  ]

  return (
    <Card className="mac-card border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <PenaltyIcon className="w-5 h-5 text-neon-red" />
          <span>{t('penaltyConfig.title')}</span>
          {isSessionActive && (
            <span className="text-xs px-2 py-0.5 bg-neon-red/20 text-neon-red rounded-full ml-auto">
              {t('penaltyConfig.activeNotEditable')}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-mac-textSecondary mb-4">
          {t('penaltyConfig.description')}
        </p>

        <div className="space-y-3">
          {penalties.map((penalty) => {
            const Icon = penalty.icon
            const isRequired = penalty.required
            const isDisabled = isSessionActive || isRequired
            const showSettings = penalty.hasSettings && penalty.enabled

            return (
              <div key={penalty.id} className="space-y-0">
                {/* 感測器主區塊 */}
                <div
                  className={cn(
                    "flex items-center justify-between p-3 transition-all duration-200",
                    penalty.enabled
                      ? `bg-white/5 border ${isRequired ? 'border-neon-green/50' : 'border-white/10'}`
                      : 'bg-transparent border border-transparent opacity-60',
                    showSettings ? 'rounded-t-lg' : 'rounded-lg',
                    isDisabled && !isRequired ? 'pointer-events-none' : isRequired ? '' : 'hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${penalty.enabled ? 'bg-white/10' : 'bg-white/5'}`}>
                      <Icon className={`w-4 h-4 ${penalty.enabled ? penalty.color : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={penalty.id}
                          className={`font-medium ${isRequired ? 'cursor-default' : 'cursor-pointer'} ${penalty.enabled ? 'text-white' : 'text-gray-400'}`}
                        >
                          {t(penalty.labelKey)}
                        </Label>
                        {isRequired && (
                          <span className="text-xs px-2 py-0.5 bg-neon-green/20 text-neon-green rounded-full">
                            {t('penaltyConfig.required')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-mac-textSecondary">{t(penalty.descKey)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {penalty.hasSettings && penalty.enabled && (
                      <ChevronDown className="w-4 h-4 text-white/30" />
                    )}
                    <Switch
                      id={penalty.id}
                      checked={penalty.enabled}
                      onCheckedChange={(checked) => handleToggle(penalty.id as keyof PenaltyConfig, checked)}
                      disabled={isDisabled}
                      className="data-[state=checked]:bg-neon-green"
                    />
                  </div>
                </div>

                {/* 感測器詳細設定 - 整合到區塊內 */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white/[0.02] border border-t-0 border-white/10 rounded-b-lg p-3 space-y-3">
                        {/* 噪音感測器設定 */}
                        {penalty.settingsType === 'noise' && (
                          <>
                            {/* 閾值調整 */}
                            <div>
                              <div className="flex items-center justify-between mb-6">
                                <Label className="text-xs text-mac-textSecondary">{t('penaltyConfig.noiseThreshold')}</Label>
                                <span className="text-xs font-mono text-neon-yellow">{config.noise_threshold_db} dB</span>
                              </div>
                              {/* 增加垂直間距 (py-4) 避免滑塊遮擋上下方刻度文字 */}
                              <div className="py-4">
                                <Slider
                                  value={[config.noise_threshold_db]}
                                  onValueChange={handleThresholdChange}
                                  min={40}
                                  max={140}
                                  step={5}
                                  disabled={isSessionActive}
                                  className="w-full"
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-mac-textSecondary mt-2">
                                <span>40 dB ({t('penaltyConfig.quiet')})</span>
                                <span>90 dB ({t('penaltyConfig.loud')})</span>
                              </div>
                            </div>

                            {/* 容錯持續時間 */}
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-mac-textSecondary">{t('penaltyConfig.duration')}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={localNoiseDuration}
                                  onChange={(e) => setLocalNoiseDuration(e.target.value)}
                                  onBlur={() => {
                                    const validated = parseNumericInput(localNoiseDuration, { max: 60 })
                                    setLocalNoiseDuration(String(validated))
                                    onConfigChange({ ...config, noise_duration_sec: validated })
                                  }}
                                  disabled={isSessionActive}
                                  className="w-14 h-7 text-xs text-center bg-white/5 border-white/10 focus:border-neon-yellow/50"
                                />
                                <span className="text-[10px] text-cyber-muted">{t('penaltyConfig.seconds')}</span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* 在場感測器設定 */}
                        {penalty.settingsType === 'presence' && (
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-mac-textSecondary">{t('penaltyConfig.leaveSeatAllowance')}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={localPresenceDuration}
                                onChange={(e) => setLocalPresenceDuration(e.target.value)}
                                onBlur={() => {
                                  const validated = parseNumericInput(localPresenceDuration, { max: 120 })
                                  setLocalPresenceDuration(String(validated))
                                  onConfigChange({ ...config, presence_duration_sec: validated })
                                }}
                                disabled={isSessionActive}
                                className="w-14 h-7 text-xs text-center bg-white/5 border-white/10 focus:border-neon-green/50"
                              />
                              <span className="text-[10px] text-cyber-muted">{t('penaltyConfig.seconds')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* 動態感測器統計 */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-mac-textSecondary">
            <span className="text-neon-green font-medium">
              {penalties.filter(p => p.enabled).length}
            </span>
            {' '}/ {penalties.length} {t('penaltyConfig.sensorsEnabledSuffix')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
