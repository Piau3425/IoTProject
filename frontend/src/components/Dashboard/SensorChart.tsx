import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { Activity } from 'lucide-react'
import React from 'react'

interface SensorData {
  mic_db: number
  timestamp: number
  nfc_detected?: boolean
  ldr_detected?: boolean
  box_open?: boolean
}

interface SensorChartProps {
  data: SensorData[]
  nfcDetected?: boolean
  ldrDetected?: boolean
  hardwareConnected?: boolean
}

export function SensorChart({ data, nfcDetected = false, ldrDetected = false, hardwareConnected = false }: SensorChartProps) {
  const [displayData, setDisplayData] = React.useState(data);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const updateTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    // Clear any pending update
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // Skip update if hardware is disconnected
    if (!hardwareConnected) {
      return;
    }

    // Only update if data has actually changed
    const dataChanged = data.length !== displayData.length || 
      (data.length > 0 && displayData.length > 0 && 
       data[data.length - 1]?.timestamp !== displayData[displayData.length - 1]?.timestamp);
    
    if (dataChanged) {
      setIsUpdating(true);
      
      // Debounce the update to prevent rapid flickering
      updateTimerRef.current = setTimeout(() => {
        setDisplayData(data);
        setIsUpdating(false);
      }, 100);
    }

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [data, hardwareConnected]);

  // Only compute chart data when hardware is connected
  const chartData = React.useMemo(() => {
    if (!hardwareConnected) return [];
    
    return displayData.map((d, i) => ({
      index: i,
      db: d.mic_db,
      time: new Date(d.timestamp).toLocaleTimeString()
    }));
  }, [displayData, hardwareConnected]);

  // Determine sensor connection states
  const micConnected = hardwareConnected; // Microphone is part of the main board

  return (
    <div className="mac-card p-5 interactive hover-lift animate-fade-in">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
          <Activity className={`w-4 h-4 text-neon-green transition-all duration-300 ${isUpdating ? 'animate-bounce-subtle' : ''}`} />
          即時感測器數據
        </h3>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Noise Level Chart */}
        <div className="transition-opacity duration-500" style={{ opacity: isUpdating ? 0.7 : 1 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-mac-textSecondary font-medium">環境噪音 (dB)</p>
            {!micConnected && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                未連接
              </span>
            )}
          </div>
          <div className={`h-32 glass-light rounded-xl p-2 transition-all duration-500 ${!micConnected ? 'opacity-50 bg-gray-900/20' : ''}`}>
            {!micConnected ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-400">麥克風感測器未連接</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="noiseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff9f0a" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ff9f0a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="index" 
                    tick={false}
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.1)"
                    tick={{ fill: '#a0a0a0', fontSize: 10 }}
                    domain={[30, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(45, 45, 45, 0.95)', 
                      border: '1px solid rgba(255, 159, 10, 0.5)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)'
                    }}
                    labelStyle={{ color: '#ff9f0a' }}
                    formatter={(value: number) => [`${value} dB`, '噪音']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="db" 
                    stroke="#ff9f0a" 
                    fill="url(#noiseGradient)"
                    strokeWidth={2}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
