import { useSocket } from '@/hooks/useSocket'
import { Header } from '@/components/Dashboard/Header'
import { Timer } from '@/components/Dashboard/Timer'
import { StatusPanel } from '@/components/Dashboard/StatusPanel'
import { SensorChart } from '@/components/Dashboard/SensorChart'
import { SocialSettings } from '@/components/Dashboard/SocialSettings'
import { DevPanel } from '@/components/Dashboard/DevPanel'
import { PenaltyProgress } from '@/components/Dashboard/PenaltyProgress'
import { PenaltyConfigPanel } from '@/components/Dashboard/PenaltyConfigPanel'
import { useAudio } from '@/hooks/useAudio'
import { useEffect, useRef } from 'react'

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
    <div className="min-h-screen bg-gradient-to-br from-mac-bg via-mac-surface to-mac-bg transition-all duration-1000">
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
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Timer & Settings */}
          <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Main Timer */}
            <Timer
              session={systemState?.session || null}
              onStart={startSession}
              onStop={stopSession}
              onPause={pauseSession}
              onResume={resumeSession}
              penaltyTriggered={penaltyTriggered}
              prepareRemainingMs={systemState?.prepare_remaining_ms || 0}
            />

            {/* Penalty Configuration Panel - NEW in v2.0 */}
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

            {/* Social Settings */}
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

          {/* Right Column - Status & Sensors & Dev */}
          <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            {/* Developer Panel - Only show in mock mode */}
            {hardwareStatus.mock_mode && (
              <DevPanel
                onManualControl={sendManualSensorData}
                isVisible={hardwareStatus.mock_mode}
                mockState={hardwareStatus.mock_state}
              />
            )}

            {/* Status Panel */}
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
              hallDetected={hardwareStatus.hall_detected}
              lcdDetected={hardwareStatus.lcd_detected}
            />

            {/* Sensor Charts */}
            <SensorChart 
              data={sensorHistory}
              nfcDetected={hardwareStatus.nfc_detected}
              ldrDetected={hardwareStatus.ldr_detected}
              hardwareConnected={hardwareStatus.connected}
            />
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
