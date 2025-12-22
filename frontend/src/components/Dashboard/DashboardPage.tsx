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
import { useEffect, useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'

export function Dashboard() {
  const {
    connected,
    systemState,
    hardwareStatus,
    sensorHistory,
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
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".dashboard-card", {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "back.out(1.7)",
        clearProps: "all"
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

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

  return (
    <div className="min-h-screen transition-all duration-1000">
      {/* State Transition Overlay */}
      <StateTransitionOverlay state={systemState?.hardware_state || 'IDLE'} />

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
      <main ref={containerRef} className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Timer & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Timer */}
            <div className="dashboard-card">
              <Timer
                session={systemState?.session || null}
                onStart={startSession}
                onStop={stopSession}
                onPause={pauseSession}
                onResume={resumeSession}
                penaltyTriggered={penaltyTriggered}
                prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
              />
            </div>

            {/* Penalty Configuration Panel - NEW in v2.0 */}
            <div className="dashboard-card">
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

            {/* Social Settings */}
            <div className="dashboard-card">
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
            </div>
          </div>

          {/* Right Column - Status & Sensors & Dev */}
          <div className="space-y-6">
            {/* Developer Panel - Only show in mock mode */}
            {hardwareStatus.mock_mode && (
              <div className="dashboard-card">
                <DevPanel
                  onManualControl={sendManualSensorData}
                  isVisible={hardwareStatus.mock_mode}
                  mockState={hardwareStatus.mock_state}
                />
              </div>
            )}

            {/* Status Panel */}
            <div className="dashboard-card">
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
                // v1.0: New state props
                hardwareState={systemState?.hardware_state || 'IDLE'}
                prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
                irDetected={hardwareStatus.ir_detected}
                lcdDetected={hardwareStatus.lcd_detected}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-mac-textSecondary border-t border-white/10 pt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <p className="flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105">
            <span className="inline-block w-2 h-2 rounded-full bg-neon-red animate-pulse-glow" />
            <span className="font-semibold text-white">專注執法者</span> 
            <span>v1.0</span> 
            <span className="mx-2">|</span>
            <span>零信任監控系統</span> 
            <span className="mx-2">|</span>
            <span className="text-neon-green">社死協定已啟動</span>
          </p>
          <p className="mt-2 text-mac-textSecondary/70 italic transition-all duration-300 hover:text-mac-textSecondary">
            「以問責達成紀律，以恐懼達成專注。」
          </p>
        </footer>
      </main>
    </div>
  )
}
