import { Dashboard } from '@/components/Dashboard/DashboardPage'
import { SmoothScroll } from '@/components/ui/SmoothScroll'
import { AdvancedCursor } from '@/components/ui/AdvancedCursor'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

const AnimatedRoutes = () => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AdvancedCursor />
      <SmoothScroll />
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

export default App
