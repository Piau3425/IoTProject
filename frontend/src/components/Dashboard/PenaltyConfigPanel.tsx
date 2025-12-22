import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { 
  Smartphone, 
  User, 
  Volume2, 
  Box,
  Shield
} from 'lucide-react'
import { PenaltyConfig } from '@/hooks/useSocket'

interface PenaltyConfigPanelProps {
  config: PenaltyConfig
  onConfigChange: (config: PenaltyConfig) => void
  isSessionActive?: boolean
}

export function PenaltyConfigPanel({ 
  config, 
  onConfigChange,
  isSessionActive = false 
}: PenaltyConfigPanelProps) {
  
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

  const penalties = [
    {
      id: 'enable_phone_penalty',
      label: '手機鎖定',
      description: 'NFC 偵測手機移除',
      icon: Smartphone,
      color: 'text-blue-400',
      enabled: true,
      required: true
    },
    {
      id: 'enable_box_open_penalty',
      label: '盒蓋關閉',
      description: 'LDR 偵測開蓋',
      icon: Box,
      color: 'text-purple-400',
      enabled: true,
      required: true
    },
    {
      id: 'enable_presence_penalty',
      label: '人員在座',
      description: '雷達偵測離座',
      icon: User,
      color: 'text-green-400',
      enabled: config.enable_presence_penalty,
      required: false
    },
    {
      id: 'enable_noise_penalty',
      label: '環境安靜',
      description: '麥克風偵測噪音',
      icon: Volume2,
      color: 'text-yellow-400',
      enabled: config.enable_noise_penalty,
      required: false
    }
  ]

  return (
    <Card className="mac-card border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Shield className="w-5 h-5 text-neon-red" />
          <span>懲罰感測器配置</span>
          {isSessionActive && (
            <span className="text-xs px-2 py-0.5 bg-neon-red/20 text-neon-red rounded-full ml-auto">
              專注中 - 無法修改
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-mac-textSecondary mb-4">
          選擇哪些感測器違規會觸發社死懲罰。未選取的感測器仍會顯示狀態，但不會觸發懲罰。
        </p>
        
        <div className="space-y-3">
          {penalties.map((penalty) => {
            const Icon = penalty.icon
            const isRequired = penalty.required
            const isDisabled = isSessionActive || isRequired
            
            return (
              <div 
                key={penalty.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                  penalty.enabled 
                    ? `bg-white/5 border ${isRequired ? 'border-neon-green/50' : 'border-white/10'}` 
                    : 'bg-transparent border border-transparent opacity-60'
                } ${isDisabled && !isRequired ? 'pointer-events-none' : isRequired ? '' : 'hover:bg-white/5'}`}
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
                        {penalty.label}
                      </Label>
                      {isRequired && (
                        <span className="text-xs px-2 py-0.5 bg-neon-green/20 text-neon-green rounded-full">
                          必要
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-mac-textSecondary">{penalty.description}</p>
                  </div>
                </div>
                <Switch
                  id={penalty.id}
                  checked={penalty.enabled}
                  onCheckedChange={(checked) => handleToggle(penalty.id as keyof PenaltyConfig, checked)}
                  disabled={isDisabled}
                  className="data-[state=checked]:bg-neon-green"
                />
              </div>
            )
          })}
        </div>

        {/* Noise Threshold Slider - Only show if noise penalty is enabled */}
        {config.enable_noise_penalty && (
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-mac-textSecondary">噪音閾值</Label>
              <span className="text-sm font-mono text-neon-yellow">{config.noise_threshold_db} dB</span>
            </div>
            <Slider
              value={[config.noise_threshold_db]}
              onValueChange={handleThresholdChange}
              min={40}
              max={90}
              step={5}
              disabled={isSessionActive}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-mac-textSecondary mt-1">
              <span>40 dB (安靜)</span>
              <span>90 dB (非常吵)</span>
            </div>
          </div>
        )}

        {/* Active Sensors Summary */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-mac-textSecondary">
            <span className="text-neon-green font-medium">
              {penalties.filter(p => p.enabled).length}
            </span>
            {' '}/ {penalties.length} 感測器啟用懲罰
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
