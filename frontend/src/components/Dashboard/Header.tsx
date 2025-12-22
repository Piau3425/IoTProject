import { Switch } from '@/components/ui/switch'
import { Cpu, Shield, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  connected: boolean
  hardwareConnected: boolean
  isMock: boolean
  mockModeLoading?: boolean
  onToggleMock: (enabled: boolean) => void
}

export function Header({ connected, hardwareConnected, isMock, mockModeLoading, onToggleMock }: HeaderProps) {
  const [optimisticMockState, setOptimisticMockState] = useState(isMock)
  
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
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-3 group cursor-default">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-all duration-500 group-hover:border-primary/50 group-hover:bg-primary/10">
            <Shield className="h-5 w-5 text-foreground transition-colors group-hover:text-primary" />
            <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-neon-green shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-none">
              Focus<span className="text-primary">Enforcer</span>
            </h1>
            <span className="text-[10px] font-medium text-muted-foreground tracking-[0.2em] uppercase mt-1 group-hover:text-primary/80 transition-colors">
              零信任監控系統
            </span>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Connection Status */}
          <div className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300",
            connected 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
              : "bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
          )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{connected ? '系統連線正常' : '連線中斷'}</span>
          </div>

          {/* Hardware Status */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/5">
            <div className="flex items-center gap-2" title="硬體模擬模式">
              <Cpu className={cn("h-4 w-4 transition-colors", hardwareConnected ? "text-primary" : "text-muted-foreground")} />
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {mockModeLoading ? '同步中...' : '模擬硬體'}
              </span>
            </div>
            <Switch 
              checked={optimisticMockState}
              onCheckedChange={handleToggle}
              disabled={mockModeLoading}
              className="data-[state=checked]:bg-primary scale-90"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
