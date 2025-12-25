/**
 * 感測器即時趨勢圖 (SensorChart)
 * 負責將後端推送的環境噪音 (dB) 數據視覺化。
 * 組件包含數據防抖處理 (Debounce)、硬體連線狀態檢查、以及基於 Recharts 的面積圖渲染。
 */
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { AudioLines } from 'lucide-react'
import React from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface SensorData {
  mic_db: number
  timestamp: number
  nfc_detected?: boolean
  ldr_detected?: boolean
  box_open?: boolean
}

interface SensorChartProps {
  data: SensorData[]
  hardwareConnected?: boolean // 硬體是否處於連線狀態
}

export function SensorChart({ data, hardwareConnected = false }: SensorChartProps) {
  const { t } = useLanguage()
  const [displayData, setDisplayData] = React.useState(data);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const updateTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  // 追蹤更新頻率，當更新過於頻繁時禁用動畫以維持效能
  const lastUpdateRef = React.useRef<number>(0);
  const [isAnimationActive, setIsAnimationActive] = React.useState(true);

  // 數據同步與更新邏輯：為了避免圖表過於頻繁動盪導致視覺疲勞，引入了簡單的防抖
  React.useEffect(() => {
    // 清除待處理的更新
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // 若硬體未連線，不進行圖表數據更新
    if (!hardwareConnected) {
      return;
    }

    // 防抖處理：增加至 300ms 以減少高頻渲染負擔
    updateTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      // 若更新頻率高於 500ms，暫時禁用動畫以維持效能
      if (timeSinceLastUpdate < 500) {
        setIsAnimationActive(false);
      } else {
        setIsAnimationActive(true);
      }
      lastUpdateRef.current = now;

      setDisplayData(prevData => {
        // 僅在數據真正變動（長度不同或最新的時間戳不同）時才觸發狀態更新
        const dataChanged = data.length !== prevData.length ||
          (data.length > 0 && prevData.length > 0 &&
            data[data.length - 1]?.timestamp !== prevData[prevData.length - 1]?.timestamp);

        if (dataChanged) {
          setIsUpdating(true);
          // 動畫過渡後重置狀態
          setTimeout(() => setIsUpdating(false), 100);
          return data;
        }
        return prevData;
      });
    }, 300);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [data, hardwareConnected]);

  // 圖表數據備忘錄，優化效能：僅在顯示數據或連線狀態改變時重新計算
  const chartData = React.useMemo(() => {
    if (!hardwareConnected) return [];

    return displayData.map((d, i) => ({
      index: i,
      db: d.mic_db,
      time: new Date(d.timestamp).toLocaleTimeString()
    }));
  }, [displayData, hardwareConnected]);

  // 目前系統主板內建麥克風，因此連線狀態與主板一致
  const micConnected = hardwareConnected;

  return (
    <div className="mac-card p-5 interactive hover-lift animate-fade-in">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
          <AudioLines className={`w-4 h-4 text-neon-green transition-all duration-300 ${isUpdating ? 'animate-bounce-subtle' : ''}`} />
          {t('sensorChart.title')}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 噪音水平分佈圖表 */}
        <div className="transition-opacity duration-500" style={{ opacity: isUpdating ? 0.7 : 1 }}>
          <div className="flex items-center justify-between mb-3 text-white">
            <p className="text-xs text-mac-textSecondary font-medium font-chinese">{t('sensorChart.environmentNoise')}</p>
            {!micConnected && (
              <span className="text-xs text-gray-400 flex items-center gap-1 font-chinese">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                {t('sensorChart.notConnected')}
              </span>
            )}
          </div>
          <div className={`h-32 glass-light rounded-xl p-2 transition-all duration-500 ${!micConnected ? 'opacity-50 bg-gray-900/20' : ''}`}>
            {!micConnected ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-400 font-chinese">{t('sensorChart.micNotConnected')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="noiseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff9f0a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ff9f0a" stopOpacity={0} />
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
                    domain={[30, 100]} // 噪音範圍通常設定在 30-100dB 以獲得較佳視覺對比
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(25, 25, 25, 0.98)', // Opaque dark background
                      border: '1px solid rgba(255, 159, 10, 0.5)',
                      borderRadius: '12px',
                      // backdropFilter: 'blur(10px)'
                    }}
                    labelStyle={{ color: '#ff9f0a' }}
                    formatter={(value: number) => [`${value} dB`, t('sensorChart.noise')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="db"
                    stroke="#ff9f0a"
                    fill="url(#noiseGradient)"
                    strokeWidth={2}
                    isAnimationActive={isAnimationActive}
                    animationDuration={200}
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
