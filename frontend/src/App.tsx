import { Dashboard } from '@/components/Dashboard/DashboardPage'
import { CustomCursor } from '@/components/Landing/CustomCursor'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <>
      <CustomCursor />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
