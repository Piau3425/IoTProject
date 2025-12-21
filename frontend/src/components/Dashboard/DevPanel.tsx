import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Smartphone, 
  User, 
  CreditCard, 
  Box,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react'
import type { MockState } from '@/hooks/useSocket'

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
  const [collapsed, setCollapsed] = useState(false)
  
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
    sendManualData({ nfc_valid: true, phone_inserted: true })
  }

  const triggerNfcInvalid = () => {
    sendManualData({ nfc_valid: false })
  }

  if (!isVisible) return null

  return (
    <Card className="border-neon-purple/30 bg-cyber-dark/50 backdrop-blur-sm">
      <CardHeader 
        className="cursor-pointer select-none hover:bg-cyber-darker/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-neon-purple" />
            <CardTitle className="text-lg font-chinese">開發者面板</CardTitle>
            <Badge variant="outline" className="border-neon-purple text-neon-purple font-chinese">
              虛擬模式
            </Badge>
          </div>
          {collapsed ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <CardDescription className="font-chinese">
          手動硬體模擬控制（測試用）
        </CardDescription>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            {/* Phone Status Control */}
            <div className="space-y-2 p-2 border border-border/30 rounded-md bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium font-chinese">手機</span>
                </div>
                <Badge variant={phoneInserted ? "default" : "destructive"} className="text-[10px] h-5 px-1.5 font-chinese">
                  {phoneInserted ? "已放入" : "已移除"}
                </Badge>
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
            <div className="space-y-2 p-2 border border-border/30 rounded-md bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium font-chinese">人員</span>
                </div>
                <Badge variant={personPresent ? "default" : "destructive"} className="text-[10px] h-5 px-1.5 font-chinese">
                  {personPresent ? "在座" : "離座"}
                </Badge>
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
            <div className="space-y-2 p-2 border border-border/30 rounded-md bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium font-chinese">盒蓋</span>
                </div>
                <Badge variant={boxOpen ? "destructive" : "default"} className="text-[10px] h-5 px-1.5 font-chinese">
                  {boxOpen ? "已開啟" : "已關閉"}
                </Badge>
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
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground font-chinese">感測器觸發</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={triggerNfcValid}
                variant="outline"
                className="h-8 text-xs border-neon-green/30 text-neon-green hover:bg-neon-green/10"
                size="sm"
              >
                有效 NFC
              </Button>
              <Button
                onClick={triggerNfcInvalid}
                variant="outline"
                className="h-8 text-xs border-neon-red/30 text-neon-red hover:bg-neon-red/10"
                size="sm"
              >
                無效 NFC
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
