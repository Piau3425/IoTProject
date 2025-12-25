/**
 * 專案的客戶端掛載點。
 * 執行 React 渲染流程，並設置全域錯誤監聯器以增強應用的穩定性。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { LanguageProvider } from './context/LanguageContext.tsx'
import './index.css'

/**
 * 全域異常捕獲機制
 * 用於捕捉那些未被 React ErrorBoundary 攔截的底層錯誤或 Promise 異常。
 * 這能幫助我們在開發與運行期間更容易追蹤到環境或網頁生命週期中的潛在問題。
 */
window.addEventListener('error', (event) => {
  console.error('偵測到未捕獲的全域錯誤 (Global Error):', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('偵測到未處理的 Promise 拒絕 (Unhandled Rejection):', event.reason)
})

// 初始化 React 應用根節點並掛載
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 多語言 Provider，提供翻譯函數和語言切換功能 */}
    <LanguageProvider>
      {/* 自定義錯誤邊界組件，用於捕捉 React 渲染樹中的 UI 崩潰 */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LanguageProvider>
  </React.StrictMode>,
)
