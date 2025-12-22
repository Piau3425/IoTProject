import { Switch } from '@/components/ui/switch'
import { Cpu, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Logo } from '@/components/Logo'

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
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl supports-[backdrop-filter]:bg-black/60"
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo Area */}
        <div className="flex items-center gap-3 group cursor-default select-none">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-all duration-500 hover:border-neon-blue/50 hover:bg-neon-blue/10">
            <Logo className="h-full w-full p-2 opacity-90 group-hover:opacity-100 transition-opacity" />
            <motion.div
              animate={{
                boxShadow: ["0 0 0px rgba(16,185,129,0)", "0 0 10px rgba(16,185,129,0.5)", "0 0 0px rgba(16,185,129,0)"],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-neon-green"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-white leading-none font-display">
              專注<span className="text-neon-blue">執法者</span>
            </h1>
            <span className="text-[10px] font-medium text-cyber-muted tracking-[0.2em] uppercase mt-1 group-hover:text-neon-blue transition-colors">
              零信任監控系統
            </span>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Connection Status */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono transition-all duration-300",
              connected
                ? "bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "bg-neon-red/10 text-neon-red border border-neon-red/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{connected ? '系統連線正常' : '連線中斷'}</span>
          </motion.div>

          {/* Hardware Status */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/5">
            <div className="flex items-center gap-2" title="硬體模擬模式">
              <Cpu className={cn("h-4 w-4 transition-colors", hardwareConnected ? "text-neon-blue" : "text-cyber-muted")} />
              <span className="hidden sm:inline text-xs font-mono text-cyber-muted">
                {mockModeLoading ? '同步中...' : '模擬硬體'}
              </span>
            </div>
            <Switch
              checked={optimisticMockState}
              onCheckedChange={handleToggle}
              disabled={mockModeLoading}
              className="data-[state=checked]:bg-neon-blue scale-90"
            />
          </div>
        </div>
      </div>
    </motion.header>
  )
}
