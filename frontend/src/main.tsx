import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

// 全域錯誤處理 - 防止未捕獲的錯誤導致黑屏
window.addEventListener('error', (event) => {
  console.error('未捕獲的全域錯誤:', event.error)
  // 在控制台顯示錯誤，但不阻止應用運行
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('未處理的 Promise 拒絕:', event.reason)
  // 在控制台顯示錯誤，但不阻止應用運行
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
