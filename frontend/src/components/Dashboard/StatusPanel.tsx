import React, { useRef, useState, useEffect } from 'react';
import { 
  Smartphone, 
  User, 
  Volume2, 
  Activity,
  Cpu,
  Zap,
  ScanLine
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { useSystemLock } from '@/hooks/usePhysics';
import { cn } from '@/lib/utils';

// v1.0: Hardware state machine states
type HardwareState = 'IDLE' | 'PREPARING' | 'FOCUSING' | 'PAUSED' | 'VIOLATION' | 'ERROR';

interface StatusPanelProps {
  phoneStatus: 'LOCKED' | 'REMOVED' | 'UNKNOWN'
  presenceStatus: 'DETECTED' | 'AWAY' | 'UNKNOWN'
  boxStatus: 'CLOSED' | 'OPEN' | 'UNKNOWN'
  currentDb: number
  hardwareConnected: boolean
  isMock?: boolean
  hardwareBoard?: string
  nfcDetected?: boolean
  ldrDetected?: boolean
  radarDetected?: boolean
  hardwareState?: HardwareState
  prepareRemainingMs?: number
  irDetected?: boolean
  lcdDetected?: boolean
}

const StatusModule = ({ 
  icon: Icon, 
  label, 
  value, 
  status, 
  subValue 
}: { 
  icon: any, 
  label: string, 
  value: React.ReactNode, 
  status: 'active' | 'inactive' | 'warning' | 'error',
  subValue?: string
}) => {
  const colorMap = {
    active: "text-neon-green border-neon-green/30 bg-neon-green/5",
    inactive: "text-mac-textSecondary border-white/10 bg-white/5",
    warning: "text-neon-yellow border-neon-yellow/30 bg-neon-yellow/5",
    error: "text-neon-red border-neon-red/30 bg-neon-red/5"
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-4 transition-all duration-500",
      colorMap[status]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
          <div className="text-lg font-semibold tracking-tight">{value}</div>
          {subValue && <p className="text-xs opacity-50">{subValue}</p>}
        </div>
        <div className={cn(
          "rounded-full p-2",
          status === 'active' ? "bg-neon-green/10 text-neon-green" : 
          status === 'error' ? "bg-neon-red/10 text-neon-red" :
          "bg-white/5 text-mac-textSecondary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      
      {/* Scanline effect for active modules */}
      {status === 'active' && (
        <div className="absolute inset-0 pointer-events-none bg-scanline opacity-10" />
      )}
    </div>
  );
};

export function StatusPanel({ 
  phoneStatus, 
  presenceStatus,
  currentDb,
  hardwareConnected,
  isMock,
  hardwareBoard = 'D1-mini',
  nfcDetected = false,
  radarDetected = false,
  irDetected = false,
  hardwareState = 'IDLE',
}: StatusPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Throttled DB value for display to prevent rapid flickering
  const [displayDb, setDisplayDb] = useState(currentDb);
  const lastUpdateRef = useRef(0);
  
  useEffect(() => {
    const now = Date.now();
    // Update max 4 times per second (250ms)
    if (now - lastUpdateRef.current > 250) {
      setDisplayDb(currentDb);
      lastUpdateRef.current = now;
    }
  }, [currentDb]);
  
  // Apply system lock effect when in FOCUSING state
  useSystemLock(panelRef, hardwareState === 'FOCUSING');

  return (
    <Card ref={panelRef} className="h-full border-white/10 bg-black/40 backdrop-blur-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-mac-textSecondary uppercase tracking-widest">
            系統狀態監控
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              hardwareConnected ? "bg-neon-green" : "bg-neon-red"
            )} />
            <span className="text-xs font-mono text-mac-textSecondary">
              {hardwareConnected ? "連線中" : "離線"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        
        {/* Primary Status Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatusModule 
            icon={Smartphone}
            label="手機鎖定"
            value={phoneStatus === 'LOCKED' ? "安全" : "未鎖定"}
            status={phoneStatus === 'LOCKED' ? 'active' : 'error'}
            subValue={nfcDetected ? "NFC 訊號鎖定" : "無訊號"}
          />
          
          <StatusModule 
            icon={User}
            label="使用者偵測"
            value={presenceStatus === 'DETECTED' ? "在位" : "離席"}
            status={presenceStatus === 'DETECTED' ? 'active' : 'error'}
            subValue={radarDetected ? "雷達鎖定" : "搜尋中..."}
          />

          {/* KY-033 IR Sensor Module */}
          <StatusModule 
            icon={ScanLine}
            label="紅外線感測"
            value={irDetected ? "觸發" : "待機"}
            status={irDetected ? 'warning' : 'inactive'}
            subValue="循跡模組監控中"
          />

          <StatusModule 
            icon={Activity}
            label="系統狀態"
            value={hardwareState}
            status={hardwareState === 'FOCUSING' ? 'active' : 'inactive'}
            subValue={isMock ? "模擬模式" : "硬體連線"}
          />
        </div>

        {/* Noise Level - Special Animated Module */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-mac-textSecondary">環境噪音</span>
            <Volume2 className={cn(
              "h-4 w-4 transition-colors duration-300",
              displayDb > 70 ? "text-neon-red" : "text-neon-blue"
            )} />
          </div>
          
          <div className="flex items-baseline gap-1 w-32">
            <AnimatedNumber 
              value={displayDb} 
              precision={1} 
              className={cn(
                "text-3xl font-bold font-mono transition-colors duration-300",
                displayDb > 70 ? "text-neon-red" : "text-white"
              )}
            />
            <span className="text-sm text-mac-textSecondary">dB</span>
          </div>
          
          {/* Visualizer Bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 ease-out",
                displayDb > 70 ? "bg-neon-red" : "bg-neon-blue"
              )}
              style={{ width: `${Math.min((displayDb / 100) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Hardware Info Footer */}
        <div className="pt-2 border-t border-white/5">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-mac-textSecondary/60">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span>{hardwareBoard}</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{hardwareState}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{isMock ? "模擬" : "實時"}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
