import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'

interface Props {
  children: ReactNode
  t: (key: string) => string  // 翻譯函數由 wrapper 傳入
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundaryInner extends Component<Props, State> {
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
    console.error('Error Boundary caught error:', error, errorInfo)
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
    const { t } = this.props

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cyber-darker flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-card border-2 border-destructive rounded-lg p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-destructive neon-red mb-2 font-orbitron">
                {t('errorBoundary.systemError')}
              </h1>
              <p className="text-muted-foreground font-chinese">
                {t('errorBoundary.unrecoverableError')}
              </p>
            </div>

            {this.state.error && (
              <div className="bg-background/50 rounded p-4 mb-6 border border-border">
                <h2 className="text-sm font-semibold text-destructive mb-2">{t('errorBoundary.errorMessage')}</h2>
                <pre className="text-xs text-foreground/80 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="bg-background/50 rounded p-4 mb-6 border border-border">
                <summary className="text-sm font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                  {t('errorBoundary.stackDetails')}
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
                {t('errorBoundary.tryRecover')}
              </Button>
              <Button
                onClick={this.handleReload}
                className="bg-destructive hover:bg-destructive/90 font-chinese"
              >
                {t('errorBoundary.reloadPage')}
              </Button>
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground font-chinese">
              <p>{t('errorBoundary.persistentError')}</p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper 組件：使用 useLanguage hook 並將 t 函數傳給 Class Component
function ErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  return <ErrorBoundaryInner t={t}>{children}</ErrorBoundaryInner>
}

export default ErrorBoundary
