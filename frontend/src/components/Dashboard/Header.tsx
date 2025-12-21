import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MagneticButton } from '@/components/Landing/MagneticButton'
import { Cpu, Zap, Shield, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface HeaderProps {
  connected: boolean
  hardwareConnected: boolean
  isMock: boolean
  mockModeLoading?: boolean
  onToggleMock: (enabled: boolean) => void
}

export function Header({ connected, hardwareConnected, isMock, mockModeLoading, onToggleMock }: HeaderProps) {
  // Optimistic UI state - show intended state while loading
  const [optimisticMockState, setOptimisticMockState] = useState(isMock)
  
  // Update optimistic state when actual state changes
  useEffect(() => {
    if (!mockModeLoading) {
      setOptimisticMockState(isMock)
    }
  }, [isMock, mockModeLoading])
  
  const handleToggle = (enabled: boolean) => {
    setOptimisticMockState(enabled)
    onToggleMock(enabled)
  }
  
  return (
    <header className="glass border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl animate-slide-down">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <MagneticButton 
            as="div" 
            className="flex items-center gap-4 group"
            strength={0.3}
          >
            <div className="relative hover-lift transition-all duration-500">
              <Shield className="w-10 h-10 text-neon-red group-hover:scale-110 transition-all duration-500" />
              <Zap className="w-4 h-4 text-neon-green absolute -bottom-1 -right-1 animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-neon-red transition-all duration-300">專注</span>
                <span className="text-white transition-all duration-300">執法者</span>
              </h1>
              <p className="hidden sm:block text-xs text-mac-textSecondary font-medium transition-all duration-300">
                零信任監控系統 v1.0
              </p>
            </div>
          </MagneticButton>

          {/* Status & Controls */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Connection Status */}
            <MagneticButton 
              as="div"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-light transition-all duration-300 hover:bg-white/10"
              strength={0.25}
            >
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                connected ? 'bg-neon-green animate-pulse-glow shadow-glow-green' : 'bg-neon-red shadow-glow-red'
              }`} />
              <span className="hidden sm:inline text-xs text-mac-textSecondary font-medium">
                {connected ? '通訊連線中' : '通訊中斷'}
              </span>
            </MagneticButton>

            {/* Mock Hardware Toggle */}
            <MagneticButton
              as="div"
              className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg glass-light border transition-all duration-300 ${
                mockModeLoading 
                  ? 'border-neon-yellow/50 bg-neon-yellow/10' 
                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              }`}
              strength={0.3}
            >
              {mockModeLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-neon-yellow animate-spin" />
              ) : (
                <Cpu className={`w-3.5 h-3.5 transition-all duration-500 ${
                  hardwareConnected ? 'text-neon-green' : 'text-mac-textSecondary'
                }`} />
              )}
              <Label className={`hidden sm:inline text-xs cursor-pointer font-medium ${
                mockModeLoading ? 'text-neon-yellow' : 'text-white'
              }`}>
                {mockModeLoading ? '準備中...' : '模擬硬體'}
              </Label>
              <Switch 
                checked={optimisticMockState}
                onCheckedChange={handleToggle}
                disabled={mockModeLoading}
                className="scale-75"
              />
            </MagneticButton>
          </div>
        </div>
      </div>
    </header>
  )
}
