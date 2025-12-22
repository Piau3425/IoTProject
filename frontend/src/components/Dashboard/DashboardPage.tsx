import { useSocket } from '@/hooks/useSocket'
import { Header } from '@/components/Dashboard/Header'
import { Timer } from '@/components/Dashboard/Timer'
import { StatusPanel } from '@/components/Dashboard/StatusPanel'
import { SocialSettings } from '@/components/Dashboard/SocialSettings'
import { DevPanel } from '@/components/Dashboard/DevPanel'
import { PenaltyProgress } from '@/components/Dashboard/PenaltyProgress'
import { PenaltyConfigPanel } from '@/components/Dashboard/PenaltyConfigPanel'
import { StateTransitionOverlay } from '@/components/Dashboard/StateTransitionOverlay'
import { useAudio } from '@/hooks/useAudio'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function Dashboard() {
  const {
    connected,
    systemState,
    hardwareStatus,
    penaltyTriggered,
    mockModeLoading,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    toggleMockHardware,
    updatePenaltySettings,
    updatePenaltyConfig,
    sendManualSensorData,
  } = useSocket()

  const { play } = useAudio()
  const warningPlayedRef = useRef(false)

  // Violation Warning Audio Logic
  useEffect(() => {
    if (systemState?.session?.status === 'ACTIVE') {
      const isViolationState =
        systemState.phone_status === 'REMOVED' ||
        systemState.presence_status === 'AWAY'

      if (isViolationState && !warningPlayedRef.current) {
        play('warning')
        warningPlayedRef.current = true
      } else if (!isViolationState) {
        warningPlayedRef.current = false
      }
    } else {
      warningPlayedRef.current = false
    }
  }, [systemState, play])

  const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

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
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0" />

      <AnimatePresence>
        {/* State Transition Overlay */}
        <StateTransitionOverlay state={systemState?.hardware_state || 'IDLE'} />
      </AnimatePresence>

      {/* Penalty Progress Modal */}
      <PenaltyProgress
        isExecuting={penaltyTriggered}
        currentStep={penaltyTriggered ? 'auth' : undefined}
      />

      {/* Header */}
      <Header
        connected={connected}
        hardwareConnected={hardwareStatus.connected}
        isMock={hardwareStatus.mock_mode || false}
        mockModeLoading={mockModeLoading}
        onToggleMock={toggleMockHardware}
      />

      {/* Main Dashboard */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="container mx-auto px-4 py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column - Main Timer (Larger) */}
          <motion.div variants={itemVariants} className="lg:col-span-8 space-y-6">
            <Timer
              session={systemState?.session || null}
              onStart={startSession}
              onStop={stopSession}
              onPause={pauseSession}
              onResume={resumeSession}
              penaltyTriggered={penaltyTriggered}
              prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
            />

            {/* Split Row for Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
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

          {/* Right Column - Status/Dev */}
          <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6 flex flex-col h-full">
            <div className="flex-1 min-h-[500px]">
              <StatusPanel
                phoneStatus={systemState?.phone_status || 'UNKNOWN'}
                presenceStatus={systemState?.presence_status || 'UNKNOWN'}
                boxStatus={systemState?.box_status || 'UNKNOWN'}
                currentDb={systemState?.current_db || 40}
                hardwareConnected={hardwareStatus.connected}
                isMock={hardwareStatus.mock_mode}
                hardwareBoard={hardwareStatus.board || 'D1-mini'}
                nfcDetected={hardwareStatus.nfc_detected}
                ldrDetected={hardwareStatus.ldr_detected}
                radarDetected={hardwareStatus.radar_detected}
                hardwareState={systemState?.hardware_state || 'IDLE'}
                prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
                irDetected={hardwareStatus.ir_detected}
                lcdDetected={hardwareStatus.lcd_detected}
              />
            </div>

          </motion.div>

        </div>

        {/* Developer Panel - Overlay - Only show in mock mode */}
        <AnimatePresence>
          {hardwareStatus.mock_mode && (
            <DevPanel
              onManualControl={sendManualSensorData}
              isVisible={hardwareStatus.mock_mode}
              mockState={hardwareStatus.mock_state}
            />
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.footer
          variants={itemVariants}
          className="mt-16 text-center text-xs text-cyber-muted border-t border-white/5 pt-8"
        >
          <div className="flex flex-col items-center gap-4">
            <p className="flex items-center justify-center gap-3 transition-all duration-300 hover:scale-105">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse" />
              <span className="font-bold tracking-widest text-white uppercase">專注執法者</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">v2.0</span>
              <span className="text-white/20">|</span>
              <span className="font-light tracking-wider">零信任專注協定</span>
              <span className="text-white/20">|</span>
              <span className="text-neon-green font-mono text-[10px]">社交懲罰機制已啟動</span>
            </p>
            <p className="text-white/30 italic hover:text-white/50 transition-colors">
              「以問責達成紀律，以恐懼達成專注。」
            </p>
          </div>
        </motion.footer>
      </motion.main>
    </div>
  )
}
