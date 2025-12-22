import React, { useRef, useState, useEffect } from 'react';
import {
  Smartphone,
  User,
  Volume2,
  Gauge,
  Cpu,
  Zap,
  ScanLine,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
    active: "text-neon-green border-neon-green/30 bg-neon-green/5 shadow-[0_0_10px_rgba(0,255,159,0.1)]",
    inactive: "text-cyber-muted border-white/5 bg-white/5",
    warning: "text-neon-yellow border-neon-yellow/30 bg-neon-yellow/5",
    error: "text-neon-red border-neon-red/30 bg-neon-red/5 shadow-[0_0_10px_rgba(255,0,60,0.1)]"
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      className={cn(
        "relative overflow-hidden rounded-md border p-4 transition-all duration-500 group hover:shadow-lg hover:border-opacity-50",
        colorMap[status]
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-70">{label}</p>
          <div className="text-lg font-bold tracking-tight font-display">{value}</div>
          {subValue && <p className="text-[10px] uppercase tracking-wider opacity-60">{subValue}</p>}
        </div>
        <div className={cn(
          "rounded-sm p-2 transition-transform duration-300 group-hover:scale-110",
          status === 'active' ? "bg-neon-green/10 text-neon-green" :
            status === 'error' ? "bg-neon-red/10 text-neon-red" :
              "bg-white/5 text-cyber-muted"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Scanline effect for active modules */}
      {status === 'active' && (
        <div className="absolute inset-0 pointer-events-none bg-scanline opacity-20" />
      )}

      {/* Corner accents */}
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-30" />
    </motion.div>
  );
};

const BlurryDigit = ({ char }: { char: string }) => {
  return (
    <div className="relative w-[0.6em] h-[1em] inline-flex justify-center items-center overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={char}
          initial={{ y: "100%", opacity: 0, filter: "blur(5px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(5px)" }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8
          }}
          className="absolute inset-0 flex items-center justify-center font-bold font-mono"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

const AnimatedNumber = ({ value, threshold }: { value: number, threshold: number }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Only update if difference is significant to avoid jitter
    if (Math.abs(displayValue - value) > 0.1) {
      setDisplayValue(value);
    }
  }, [value, displayValue]);

  const valueStr = displayValue.toFixed(1);
  const isDanger = value > threshold;

  return (
    <div className={cn(
      "flex items-center text-4xl transition-colors duration-100",
      isDanger ? "text-neon-red drop-shadow-neon-red" : "text-white"
    )}>
      {valueStr.split('').map((char, index) => (
        char === '.' ? (
          <span key={`dot-${index}`} className="w-[0.3em] text-center">.</span>
        ) : (
          <BlurryDigit key={`${index}-${char}`} char={char} />
        )
      ))}
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

  return (
    <Card className="h-full border-white/10 bg-cyber-bg/80 backdrop-blur-xl overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-cyber-muted uppercase tracking-widest flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            系統狀態區域
          </CardTitle>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={cn(
                "h-2 w-2 rounded-full",
                hardwareConnected ? "bg-neon-green shadow-neon-green" : "bg-neon-red shadow-neon-red"
              )}
            />
            <span className="text-xs font-mono text-cyber-muted">
              {hardwareConnected ? "連線中" : "離線"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex-1 flex flex-col">

        {/* Primary Status Grid */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          <StatusModule
            icon={Smartphone}
            label="手機鎖定狀態"
            value={phoneStatus === 'LOCKED' ? "已鎖定" : "未鎖定"}
            status={phoneStatus === 'LOCKED' ? 'active' : 'error'}
            subValue={nfcDetected ? "NFC 已感應" : "無訊號"}
          />

          <StatusModule
            icon={User}
            label="使用者存在"
            value={presenceStatus === 'DETECTED' ? "已偵測" : "不在位"}
            status={presenceStatus === 'DETECTED' ? 'active' : 'error'}
            subValue={radarDetected ? "雷達已鎖定" : "搜尋中..."}
          />

          <StatusModule
            icon={ScanLine}
            label="紅外線感應"
            value={irDetected ? "觸發中" : "待命中"}
            status={irDetected ? 'warning' : 'inactive'}
            subValue="追蹤模組"
          />

          <StatusModule
            icon={Zap}
            label="硬體狀態"
            value={hardwareState === 'IDLE' ? '空閒' :
              hardwareState === 'PREPARING' ? '準備中' :
                hardwareState === 'FOCUSING' ? '專注中' :
                  hardwareState === 'PAUSED' ? '已暫停' :
                    hardwareState === 'VIOLATION' ? '違規中' : '錯誤'}
            status={hardwareState === 'FOCUSING' ? 'active' : 'inactive'}
            subValue={isMock ? "模擬模式" : "實體硬體"}
          />
        </motion.div>

        {/* Noise Level Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-md border border-white/10 bg-black/40 p-4 mt-auto"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyber-muted">環境音量等級</span>
            <Volume2 className={cn(
              "h-4 w-4 transition-colors duration-300",
              currentDb > 70 ? "text-neon-red" : "text-neon-blue"
            )} />
          </div>

          <div className="flex items-baseline gap-1">
            <AnimatedNumber value={currentDb} threshold={70} />
            <span className="text-sm font-mono text-cyber-muted">dB</span>
          </div>
        </motion.div>

        {/* Hardware Footer */}
        <div className="pt-2 border-t border-white/5 mt-auto">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-cyber-muted/60">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span>{hardwareBoard}</span>
            </div>
            <div className="flex items-center gap-1">
              {hardwareConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{hardwareConnected ? '已連線' : '連線中斷'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{isMock ? "模擬數據" : "實時數據"}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
