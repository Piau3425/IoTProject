/**
 * 頂部導航欄 (Header)
 * 負責展示品牌標誌、全局連線狀態 (Socket.IO)、硬體連接狀態，
 * 以及提供地獄模式切換與硬體模擬模式的控制開關。
 */
import { Switch } from '@/components/ui/switch'
import { Cpu, Wifi, WifiOff, Flame } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'
import { LanguageSelector } from './LanguageSelector'


interface HeaderProps {
  connected: boolean           // 後端 Socket.IO 連線狀態
  hardwareConnected: boolean   // 實體硬體 (ESP32) 連線狀態
  isMock: boolean              // 當前是否為模擬模式
  mockModeLoading?: boolean    // 模式切換中的讀取狀態
  onToggleMock: (enabled: boolean) => void // 切換模擬模式的回調
  hellMode?: boolean           // 地獄模式是否開啟
  onToggleHellMode?: () => void // 切換地獄模式的回調
}

export function Header({
  connected,
  hardwareConnected,
  isMock,
  mockModeLoading,
  onToggleMock,
  hellMode,
  onToggleHellMode
}: HeaderProps) {
  const { t } = useLanguage()

  // 樂觀更新狀態：在等待後端確認前先改變 UI，提升互動流暢度
  const [optimisticMockState, setOptimisticMockState] = useState(isMock)

  // 當後端正式確認狀態變更後，同步本地的樂觀狀態
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

        {/* 電競風格系統 Logo 區塊 */}
        <div className="flex items-center gap-3 group cursor-default select-none">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 transition-all duration-500 hover:border-neon-blue/50 hover:bg-neon-blue/10">
            <Logo className="h-full w-full p-2 opacity-90 group-hover:opacity-100 transition-opacity" />

            {/* 系統運作中指示燈 */}
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
              {t('header.title')}<span className="text-neon-blue">{t('header.titleHighlight')}</span>
            </h1>
            <span className="text-[10px] font-medium text-cyber-muted tracking-[0.2em] uppercase mt-1 group-hover:text-neon-blue transition-colors">
              {t('header.subtitle')}
            </span>
          </div>
        </div>

        {/* 狀態指示與功能切換區 */}
        <div className="flex items-center gap-4 sm:gap-6">

          {/* 語言切換按鈕 */}
          <LanguageSelector />

          {/* 地獄模式按鈕：高風險操作，呈現紅色呼吸燈警告風格 */}
          <Button
            variant={hellMode ? "destructive" : "outline"}
            size="sm"
            onClick={onToggleHellMode}
            className={cn(
              "flex items-center gap-2 h-8 text-xs font-chinese transition-all duration-500 border-white/10",
              hellMode ? "bg-red-900/40 border-red-500/50 text-red-500 animate-pulse hover:bg-red-900/60" : "text-cyber-muted hover:text-white hover:bg-white/5"
            )}
          >
            <Flame className={cn("w-3.5 h-3.5", hellMode && "fill-current")} />
            <span className="hidden sm:inline">{hellMode ? t('header.hellModeOn') : t('header.hellMode')}</span>
          </Button>

          {/* Socket.IO 後端連線狀態 */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono transition-all duration-300",
              connected
                ? "bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "bg-neon-red/10 text-neon-red border border-neon-red/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{connected ? t('header.systemOnline') : t('header.connectionLost')}</span>
          </motion.div>

          {/* 硬體連線與模擬模式開關 */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/5">
            <div className="flex items-center gap-2" title="硬體模擬模式">
              <Cpu className={cn("h-4 w-4 transition-colors", hardwareConnected ? "text-neon-blue" : "text-cyber-muted")} />
              <span className="hidden sm:inline text-xs font-mono text-cyber-muted">
                {mockModeLoading ? t('common.syncing') : t('header.mockHardware')}
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
