import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Smartphone,
  User,
  CreditCard,
  Box,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings
} from 'lucide-react'
import type { MockState } from '@/hooks/useSocket'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DevPanelProps {
  onManualControl: (data: ManualSensorData) => void
  isVisible?: boolean
  mockState?: MockState  // Backend's persistent mock state
}

export interface ManualSensorData {
  phone_inserted: boolean
  person_present: boolean
  nfc_valid: boolean
  box_open: boolean
}

export function DevPanel({ onManualControl, isVisible = true, mockState }: DevPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Use backend state directly - no local state needed!
  const phoneInserted = mockState?.phone_inserted ?? true
  const personPresent = mockState?.person_present ?? true
  const nfcValid = mockState?.nfc_valid ?? true
  const boxOpen = mockState?.box_open ?? false

  const sendManualData = (data: Partial<ManualSensorData>) => {
    // Send full state with overrides
    const fullData: ManualSensorData = {
      phone_inserted: data.phone_inserted ?? phoneInserted,
      person_present: data.person_present ?? personPresent,
      nfc_valid: data.nfc_valid ?? nfcValid,
      box_open: data.box_open ?? boxOpen,
    }
    onManualControl(fullData)
  }

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
    // Only set nfc_valid, don't change phone_inserted or box_open
    sendManualData({ nfc_valid: true })
  }

  const triggerNfcInvalid = () => {
    // Only set nfc_valid to false, don't change other states
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
            <Card className="border-neon-purple/30 bg-black/90 backdrop-blur-md shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-neon-purple" />
                    <CardTitle className="text-sm font-chinese text-mac-textPrimary">虛擬硬體控制台</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-neon-purple text-neon-purple text-[10px] h-5">
                    MOCK MODE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Phone Status Control */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">手機</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        phoneInserted ? "bg-neon-green/20 text-neon-green" : "bg-neon-red/20 text-neon-red"
                      )}>
                        {phoneInserted ? "INS" : "REM"}
                      </span>
                    </div>
                    <Button
                      onClick={togglePhoneInserted}
                      variant={phoneInserted ? "outline" : "destructive"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {phoneInserted ? "移除" : "放入"}
                    </Button>
                  </div>

                  {/* Person Presence Control */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">人員</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        personPresent ? "bg-neon-green/20 text-neon-green" : "bg-neon-red/20 text-neon-red"
                      )}>
                        {personPresent ? "PRS" : "ABS"}
                      </span>
                    </div>
                    <Button
                      onClick={togglePersonPresent}
                      variant={personPresent ? "outline" : "destructive"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {personPresent ? "離開" : "返回"}
                    </Button>
                  </div>

                  {/* Box Status Control */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">盒蓋</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        boxOpen ? "bg-neon-red/20 text-neon-red" : "bg-neon-green/20 text-neon-green"
                      )}>
                        {boxOpen ? "OPN" : "CLS"}
                      </span>
                    </div>
                    <Button
                      onClick={toggleBoxOpen}
                      variant={boxOpen ? "destructive" : "outline"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {boxOpen ? "關閉" : "開啟"}
                    </Button>
                  </div>

                  {/* NFC Control */}
                  <div className="space-y-2 p-2.5 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-mac-textSecondary" />
                        <span className="text-xs font-medium font-chinese text-mac-textPrimary">NFC感應</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={triggerNfcValid}
                        variant="outline"
                        className="w-full h-7 text-[10px] border-neon-green/30 text-neon-green hover:bg-neon-green/10"
                        size="sm"
                      >
                        觸發：有效卡片
                      </Button>
                      <Button
                        onClick={triggerNfcInvalid}
                        variant="outline"
                        className="w-full h-7 text-[10px] border-neon-red/30 text-neon-red hover:bg-neon-red/10"
                        size="sm"
                      >
                        觸發：無效
                      </Button>
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
    </div>
  )
}
