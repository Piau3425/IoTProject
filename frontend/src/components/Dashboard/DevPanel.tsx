/**
 * 開發者控制面板 (DevPanel / Mock Hardware Console)
 * 專為開發與測試設計的輔助工具。在「硬體模擬模式」下，
 * 此面板允許開發者手動觸發各類感測器事件（如手機移除、人員離開、盒蓋開啟等），
 * 用以驗證系統的處罰邏輯與視覺回饋是否正確。
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Smartphone,
  User,
  CreditCard,
  Box,
  ChevronDown,
  Zap,
  Settings
} from 'lucide-react'
import type { MockState } from '@/hooks/useSocket'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, parseNumericInput } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'

interface DevPanelProps {
  onManualControl: (data: ManualSensorData) => void // 送出模擬指令的回調
  isVisible?: boolean
  mockState?: MockState  // 由後端同步過來的持久化模擬狀態
}

export interface ManualSensorData {
  phone_inserted: boolean
  person_present: boolean
  nfc_valid: boolean
  box_open: boolean
  noise_min?: number
  noise_max?: number
}

export function DevPanel({ onManualControl, isVisible = true, mockState }: DevPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { t } = useLanguage()

  // 噪音範圍的本地狀態。
  // 使用 string 類型儲存輸入中間狀態，避免輸入時由於驗證導致的文字跳動。
  // 僅在使用者離開輸入欄時才進行驗證與同步。
  const [localNoiseMin, setLocalNoiseMin] = useState<string>('35')
  const [localNoiseMax, setLocalNoiseMax] = useState<string>('55')

  /**
   * 當後端的模擬狀態發生變更時（如其他客戶端更改了設定），
   * 同步更新本地的噪音輸入數值。
   */
  useEffect(() => {
    if (mockState) {
      setLocalNoiseMin(String(mockState.noise_min ?? 35))
      setLocalNoiseMax(String(mockState.noise_max ?? 55))
    }
  }, [mockState?.noise_min, mockState?.noise_max])

  // 直接解構後端的模擬狀態，若無則提供預設開發值
  const phoneInserted = mockState?.phone_inserted ?? true
  const personPresent = mockState?.person_present ?? true
  const nfcValid = mockState?.nfc_valid ?? true
  const boxOpen = mockState?.box_open ?? false

  /**
   * 封裝並送出完整的模擬數據。
   * 由於後端 API 通常需要完整的數據對象，我們在這裡處理Overrides。
   */
  const sendManualData = (data: Partial<ManualSensorData>) => {
    const currentMin = parseNumericInput(localNoiseMin, { max: 140 })
    const currentMax = parseNumericInput(localNoiseMax, { max: 140 })
    const fullData: ManualSensorData = {
      phone_inserted: data.phone_inserted ?? phoneInserted,
      person_present: data.person_present ?? personPresent,
      nfc_valid: data.nfc_valid ?? nfcValid,
      box_open: data.box_open ?? boxOpen,
      noise_min: data.noise_min ?? currentMin,
      noise_max: data.noise_max ?? currentMax,
    }
    onManualControl(fullData)
  }

  // --- 各類感測器的切換邏輯 ---

  const togglePhoneInserted = () => {
    sendManualData({ phone_inserted: !phoneInserted })
  }

  const togglePersonPresent = () => {
    sendManualData({ person_present: !personPresent })
  }

  const toggleBoxOpen = () => {
    sendManualData({ box_open: !boxOpen })
  }

  const triggerNfcValid = () => {
    sendManualData({ nfc_valid: true })
  }

  const triggerNfcInvalid = () => {
    sendManualData({ nfc_valid: false })
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[50] flex flex-col items-end gap-2">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-[320px]"
          >
            <Card className="border-neon-purple/30 bg-black/90 backdrop-blur-md shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
              <CardHeader className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-neon-purple" />
                    <CardTitle className="text-sm font-chinese text-mac-textPrimary">{t('devPanel.consoleTitle')}</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-neon-purple text-neon-purple text-[10px] h-5">
                    {t('devPanel.simulationMode')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">

                  {/* 手機插拔模擬：觸發 LDR/NFC 組合邏輯 */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">{t('devPanel.phoneSensor')}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        phoneInserted ? "bg-neon-green/20 text-neon-green" : "bg-neon-red/20 text-neon-red"
                      )}>
                        {phoneInserted ? t('devPanel.phoneInserted') : t('devPanel.phoneRemoved')}
                      </span>
                    </div>
                    <Button
                      onClick={togglePhoneInserted}
                      variant={phoneInserted ? "outline" : "destructive"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {phoneInserted ? t('devPanel.removePhone') : t('devPanel.insertPhone')}
                    </Button>
                  </div>

                  {/* 人員在場模擬：觸發雷達/人體感應邏輯 */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">{t('devPanel.personSensor')}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        personPresent ? "bg-neon-green/20 text-neon-green" : "bg-neon-red/20 text-neon-red"
                      )}>
                        {personPresent ? t('devPanel.personPresent') : t('devPanel.personAway')}
                      </span>
                    </div>
                    <Button
                      onClick={togglePersonPresent}
                      variant={personPresent ? "outline" : "destructive"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {personPresent ? t('devPanel.leaveSeat') : t('devPanel.returnSeat')}
                    </Button>
                  </div>

                  {/* 盒蓋狀態模擬：觸發霍爾/紅外線感測器邏輯 */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">{t('devPanel.boxSensor')}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        boxOpen ? "bg-neon-red/20 text-neon-red" : "bg-neon-green/20 text-neon-green"
                      )}>
                        {boxOpen ? t('devPanel.boxOpen') : t('devPanel.boxClosed')}
                      </span>
                    </div>
                    <Button
                      onClick={toggleBoxOpen}
                      variant={boxOpen ? "destructive" : "outline"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {boxOpen ? t('devPanel.closeBox') : t('devPanel.openBox')}
                    </Button>
                  </div>

                  {/* NFC 識別結果模擬 */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">{t('devPanel.nfcSensor')}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={triggerNfcValid}
                        variant="outline"
                        className="w-full h-7 text-[10px] border-neon-green/30 text-neon-green hover:bg-neon-green/10"
                        size="sm"
                      >
                        {t('devPanel.validCard')}
                      </Button>
                      <Button
                        onClick={triggerNfcInvalid}
                        variant="outline"
                        className="w-full h-7 text-[10px] border-neon-red/30 text-neon-red hover:bg-neon-red/10"
                        size="sm"
                      >
                        {t('devPanel.invalidCard')}
                      </Button>
                    </div>
                  </div>

                  {/* 噪音模擬範圍設定 */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5 col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">{t('devPanel.noiseRange')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-neon-yellow">
                        {localNoiseMin} - {localNoiseMax} dB
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={localNoiseMin}
                          onChange={(e) => setLocalNoiseMin(e.target.value)}
                          onBlur={() => {
                            const num = parseNumericInput(localNoiseMin, { max: 140 })
                            const maxVal = parseNumericInput(localNoiseMax, { max: 140 })
                            const newMin = Math.min(num, maxVal)
                            setLocalNoiseMin(String(newMin))
                            sendManualData({ noise_min: newMin, noise_max: maxVal })
                          }}
                          className="h-8 text-xs bg-black/40 border-white/10"
                          placeholder={t('devPanel.minVolume')}
                        />
                      </div>
                      <span className="text-white/20">-</span>
                      <div className="flex-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={localNoiseMax}
                          onChange={(e) => setLocalNoiseMax(e.target.value)}
                          onBlur={() => {
                            const num = parseNumericInput(localNoiseMax, { max: 140 })
                            const minVal = parseNumericInput(localNoiseMin, { max: 140 })
                            const newMax = Math.max(num, minVal)
                            setLocalNoiseMax(String(newMax))
                            sendManualData({ noise_min: minVal, noise_max: newMax })
                          }}
                          className="h-8 text-xs bg-black/40 border-white/10"
                          placeholder={t('devPanel.maxVolume')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-10 w-10 rounded-full bg-neon-purple shadow-[0_0_15px_rgba(189,52,254,0.5)] hover:bg-neon-purple/80 hover:scale-110 transition-all"
        size="icon"
      >
        {isExpanded ? (
          <ChevronDown className="h-6 w-6 text-white" />
        ) : (
          <Settings className="h-5 w-5 text-white animate-spin-slow" />
        )}
      </Button>
    </div >
  )
}
