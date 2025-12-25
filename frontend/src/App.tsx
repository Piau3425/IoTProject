/**
 * 應用程式的主要入口組件。
 * 負責設定路由 (React Router)、滑鼠視覺特效 (AdvancedCursor)、
 * 頁面平滑捲動 (SmoothScroll) 以及路由切換動畫。
 */
import { Dashboard } from '@/components/Dashboard/DashboardPage'
import { SmoothScroll } from '@/components/ui/SmoothScroll'
import { AdvancedCursor } from '@/components/ui/AdvancedCursor'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

/**
 * 處理路由切換動畫的子組件。
 * 使用 Framer Motion 的 AnimatePresence 配合 location key 
 * 來觸發頁面進入與退出的過場效果。
 */
const AnimatedRoutes = () => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* 主控制面板頁面 */}
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <BrowserRouter>
      {/* 高階游標特效，增強介面互動感 */}
      <AdvancedCursor />

      {/* 實現長頁面的平滑、具慣性的捲動體驗 */}
      <SmoothScroll />

      {/* 渲染具動畫效果的路由內容 */}
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

export default App
