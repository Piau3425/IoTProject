/**
 * 儀表板主頁面 (DashboardPage)
 * 這是前端應用的核心佈局組件，負責彙整所有子組件、管理全局連線狀態，
 * 並處理如專注違規音效提示、全域視覺特效（地獄模式、轉場遮罩）等高層級邏輯。
 */
import { useSocket } from '@/hooks/useSocket'
import { Header } from '@/components/Dashboard/Header'
import { Timer } from '@/components/Dashboard/Timer'
import { StatusPanel } from '@/components/Dashboard/StatusPanel'
import { SocialSettings } from '@/components/Dashboard/SocialSettings'
import { DevPanel } from '@/components/Dashboard/DevPanel'
import { PenaltyProgress } from '@/components/Dashboard/PenaltyProgress'
import { PenaltyConfigPanel } from '@/components/Dashboard/PenaltyConfigPanel'
import { ProgressivePenaltyConfig } from '@/components/Dashboard/ProgressivePenaltyConfig'
import type { ProgressivePenaltyRule } from '@/hooks/useSocket'
import { StateTransitionOverlay } from '@/components/Dashboard/StateTransitionOverlay'
import { ViolationStats } from '@/components/Dashboard/ViolationStats'
import { useAudio } from '@/hooks/useAudio'
import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/context/LanguageContext'

export function Dashboard() {
  const { t } = useLanguage()
  // 從自定義 Hook 獲取所有的通訊狀態與操作方法
  const {
    connected,
    systemState,
    hardwareStatus,
    penaltyTriggered,
    penaltyStep,
    penaltySteps,  // 動態步驟列表
    mockModeLoading,
    // 違規計數
    todayViolationCount,
    // 功能操作
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    toggleMockHardware,
    updatePenaltySettings,
    updatePenaltyConfig,
    sendManualSensorData,
    hellMode,
    toggleHellMode,
  } = useSocket()

  const { play } = useAudio()
  const warningPlayedRef = useRef(false)

  // 從 systemState 獲取階段性懲罰規則（持久化至後端）
  // 後端使用 snake_case (violation_count)，前端使用 camelCase (violationCount)
  const progressiveRules: ProgressivePenaltyRule[] = (
    systemState?.penalty_settings?.progressive_rules || []
  ).map((rule: { violation_count?: number; violationCount?: number; platforms: string[] }) => ({
    violationCount: rule.violation_count ?? rule.violationCount ?? 1,
    platforms: rule.platforms
  }))

  // 更新階段規則的處理函數，透過 updatePenaltySettings 保存到後端
  // 需要將 camelCase 轉換為 snake_case 以符合後端格式
  const handleProgressiveRulesChange = useCallback((newRules: ProgressivePenaltyRule[]) => {
    if (!systemState?.penalty_settings) return
    // 轉換為後端格式 (snake_case)
    const backendRules = newRules.map(rule => ({
      violation_count: rule.violationCount,
      platforms: rule.platforms
    }))
    updatePenaltySettings({
      ...systemState.penalty_settings,
      progressive_rules: backendRules as unknown as ProgressivePenaltyRule[]
    })
  }, [systemState?.penalty_settings, updatePenaltySettings])

  /**
   * 即時判斷當前感測器是否處於違規狀態。
   * 此邏輯用於前端 UI 的即時回饋（如 Timer 邊框變色或播放警告音），
   * 與後端的處罰邏輯相輔相成。
   */
  const isSensorViolated = systemState ? (
    (systemState.penalty_config?.enable_phone_penalty && systemState.phone_status === 'REMOVED') ||
    (systemState.penalty_config?.enable_presence_penalty && systemState.presence_status === 'AWAY') ||
    (systemState.penalty_config?.enable_box_open_penalty && systemState.box_status === 'OPEN')
  ) : false

  /**
   * 違規警告音效處理邏輯。
   * 當處於「專注中」且偵測到感測器異常時觸發警告音，避免使用者在不知情的狀況下被執行社交處罰。
   */
  useEffect(() => {
    if (systemState?.session?.status === 'ACTIVE') {
      if (isSensorViolated && !warningPlayedRef.current) {
        play('warning')
        warningPlayedRef.current = true
      } else if (!isSensorViolated) {
        warningPlayedRef.current = false
      }
    } else {
      warningPlayedRef.current = false
    }
  }, [systemState, play, isSensorViolated])

  // Framer Motion 動畫配置：容器層
  const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1, // 子組件依序顯現，增加動態感
        delayChildren: 0.2
      }
    }
  }

  // Framer Motion 動畫配置：單一組件層
  const itemVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 50,
        damping: 20
      } as const
    }
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text selection:bg-neon-blue/30 relative">
      {/* 背景裝飾網格 */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0" />

      <AnimatePresence>
        {/* 硬體狀態機切換時的全屏過渡遮罩 */}
        <StateTransitionOverlay state={systemState?.hardware_state || 'IDLE'} />
      </AnimatePresence>

      {/* 地獄模式視覺特效：當強制開啟時，螢幕周圍會出現暗紅色的呼吸燈效果 */}
      {hellMode && (
        <div
          className="fixed inset-0 z-[5] animate-pulse"
          style={{
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(127, 29, 29, 0.35) 100%)',
            boxShadow: 'inset 0 0 150px rgba(255, 0, 0, 0.4)',
          }}
        />
      )}

      {/* 處罰執行進度彈窗 */}
      <PenaltyProgress
        isExecuting={penaltyTriggered}
        currentStep={penaltyStep}
        dynamicSteps={penaltySteps}
      />

      {/* 頂部導航欄 */}
      <Header
        connected={connected}
        hardwareConnected={hardwareStatus.connected}
        isMock={hardwareStatus.mock_mode || false}
        mockModeLoading={mockModeLoading}
        onToggleMock={toggleMockHardware}
        hellMode={hellMode}
        onToggleHellMode={toggleHellMode}
      />

      {/* 儀表板內容區塊 */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="container mx-auto px-4 py-8 relative z-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* 左側：核心計時器與任務控制 */}
          <motion.div variants={itemVariants} className="lg:col-span-8 space-y-6 relative">
            <div className="relative">
              <Timer
                session={systemState?.session || null}
                onStart={startSession}
                onStop={stopSession}
                onPause={pauseSession}
                onResume={resumeSession}
                penaltyTriggered={penaltyTriggered}
                prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
                isSensorViolated={isSensorViolated}
                hardwareReady={hardwareStatus.connected || hardwareStatus.mock_mode || false}
                sensorsNormal={
                  (systemState?.phone_status === 'LOCKED' || systemState?.phone_status === 'UNKNOWN') &&
                  (systemState?.presence_status === 'DETECTED' || systemState?.presence_status === 'UNKNOWN') &&
                  (systemState?.box_status === 'CLOSED' || systemState?.box_status === 'UNKNOWN')
                }
              />

              {/* 注意：地獄模式僅提供視覺效果，不阻擋操作 */}
            </div>

            {/* 配置區域：處罰條件與社交平台設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
                <ProgressivePenaltyConfig
                  rules={progressiveRules}
                  onRulesChange={handleProgressiveRulesChange}
                  availablePlatforms={systemState?.penalty_settings?.enabled_platforms || []}
                  isSessionActive={systemState?.session?.status === 'ACTIVE'}
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <SocialSettings
                  settings={systemState?.penalty_settings || {
                    enabled_platforms: [],
                    custom_messages: {},
                    gmail_recipients: [],
                    include_timestamp: true,
                    include_violation_count: true,
                  }}
                  onSave={updatePenaltySettings}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* 右側：即時感測器數據面板 */}
          <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6 flex flex-col">
            <div className="">
              <ViolationStats todayViolationCount={todayViolationCount} />
            </div>
            <div className="">
              <StatusPanel
                phoneStatus={systemState?.phone_status || 'UNKNOWN'}
                presenceStatus={systemState?.presence_status || 'UNKNOWN'}
                boxStatus={systemState?.box_status || 'UNKNOWN'}
                currentDb={systemState?.current_db || 40}
                hardwareConnected={hardwareStatus.connected}
                isMock={hardwareStatus.mock_mode}
                hardwareBoard={hardwareStatus.board || 'D1-mini'}
                nfcDetected={hardwareStatus.nfc_detected}
                radarDetected={hardwareStatus.radar_detected}
                hardwareState={systemState?.hardware_state || 'IDLE'}
                irDetected={hardwareStatus.ir_detected}
                lcdDetected={hardwareStatus.lcd_detected}
                personAwaySince={systemState?.person_away_since}
                noiseStartTime={systemState?.noise_start_time}
                noiseThreshold={systemState?.penalty_config?.noise_threshold_db}
                noiseDuration={systemState?.penalty_config?.noise_duration_sec}
                sessionStatus={systemState?.session?.status}
              />
            </div>

            <div className="flex-none">
              <PenaltyConfigPanel
                config={systemState?.penalty_config || {
                  enable_phone_penalty: true,
                  enable_presence_penalty: true,
                  enable_noise_penalty: false,
                  enable_box_open_penalty: true,
                  noise_threshold_db: 70
                }}
                onConfigChange={updatePenaltyConfig}
                isSessionActive={systemState?.session?.status === 'ACTIVE'}
              />
            </div>
          </motion.div>

        </div>

        {/* 開發者控制台：僅在硬體模擬模式下顯示，用於手動觸發感測器狀態 */}
        <AnimatePresence>
          {hardwareStatus.mock_mode && (
            <DevPanel
              onManualControl={sendManualSensorData}
              isVisible={hardwareStatus.mock_mode}
              mockState={hardwareStatus.mock_state}
            />
          )}
        </AnimatePresence>

        {/* 頁尾資訊 */}
        <motion.footer
          variants={itemVariants}
          className="mt-16 text-center text-xs text-cyber-muted border-t border-white/5 pt-8"
        >
          <div className="flex flex-col items-center gap-4">
            <p className="flex items-center justify-center gap-3 transition-all duration-300 hover:scale-105">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse" />
              <span className="font-bold tracking-widest text-white uppercase">{t('dashboard.focusEnforcer')}</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">v1.0</span>
              <span className="text-white/20">|</span>
              <span className="font-light tracking-wider">{t('dashboard.zeroTrustProtocol')}</span>
              <span className="text-white/20">|</span>
              <span className="text-neon-green font-mono text-[10px]">{t('dashboard.socialPenaltyActivated')}</span>
            </p>
            <p className="text-white/30 italic hover:text-white/50 transition-colors">
              {t('dashboard.quote')}
            </p>
          </div>
        </motion.footer>
      </motion.main>
    </div >
  )
}
