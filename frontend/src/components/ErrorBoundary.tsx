import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('錯誤邊界捕獲到錯誤:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cyber-darker flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-card border-2 border-destructive rounded-lg p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-destructive neon-red mb-2 font-orbitron">
                系統錯誤
              </h1>
              <p className="text-muted-foreground font-chinese">
                應用程式遇到了一個無法恢復的錯誤
              </p>
            </div>

            {this.state.error && (
              <div className="bg-background/50 rounded p-4 mb-6 border border-border">
                <h2 className="text-sm font-semibold text-destructive mb-2">錯誤訊息：</h2>
                <pre className="text-xs text-foreground/80 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="bg-background/50 rounded p-4 mb-6 border border-border">
                <summary className="text-sm font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                  詳細堆疊資訊（點擊展開）
                </summary>
                <pre className="text-xs text-foreground/60 overflow-auto mt-2 max-h-64">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-4 justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="font-chinese"
              >
                嘗試恢復
              </Button>
              <Button
                onClick={this.handleReload}
                className="bg-destructive hover:bg-destructive/90 font-chinese"
              >
                重新載入頁面
              </Button>
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground font-chinese">
              <p>如果問題持續發生，請檢查瀏覽器控制台以獲取更多資訊</p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
