import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skull, Save, LogIn, KeyRound, LogOut, CheckCircle, XCircle, AlertCircle, X, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

import { DiscordIcon, GmailIcon } from '@/components/Icons'

interface PenaltySettings {
  enabled_platforms: string[]
  custom_messages: Record<string, string>
  gmail_recipients: string[]
  include_timestamp: boolean
  include_violation_count: boolean
}

interface SocialSettingsProps {
  settings: PenaltySettings
  onSave: (settings: PenaltySettings) => void
}

const PLATFORMS = [
  { id: 'discord', name: 'Discord', icon: <DiscordIcon className="w-6 h-6" />, color: 'text-indigo-400', description: 'Webhook 訊息' },
  { id: 'gmail', name: 'Gmail', icon: <GmailIcon className="w-6 h-6" />, color: 'text-red-400', description: '電子郵件' },
]

const DEFAULT_MESSAGES: Record<string, string> = {
  discord: '🚨 警報：我違反了專注協定，剛才的專注挑戰失敗了。請大家監督我改進！ 🚨',
  threads: '📢 系統公告：我未能完成專注任務，違反了自律協定。我會繼續努力改進。',
  gmail: '📧 專注執法者通報：我未能完成專注任務，將加強自我管理。'
}

export function SocialSettings({ settings, onSave }: SocialSettingsProps) {
  const [localSettings, setLocalSettings] = useState<PenaltySettings>(settings)
  const [hasChanges, setHasChanges] = useState(false)
  const [loginLoading, setLoginLoading] = useState<string | null>(null)
  const [loginStatus, setLoginStatus] = useState<Record<string, boolean>>({})
  const [loginError, setLoginError] = useState<string | null>(null)
  const [newRecipient, setNewRecipient] = useState<string>('')
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)

  // 登入表單狀態
  const [showLoginForm, setShowLoginForm] = useState<string | null>(null)
  const [gmailForm, setGmailForm] = useState({ email: '', appPassword: '' })
  const [threadsForm, setThreadsForm] = useState({ userId: '', accessToken: '' })
  const [threadsBrowserForm, setThreadsBrowserForm] = useState({ username: '', password: '' })
  const [threadsLoginMode, setThreadsLoginMode] = useState<'simple' | 'advanced'>('advanced')
  const [discordForm, setDiscordForm] = useState({ webhookUrl: '' })

  // Fetch login status for all platforms
  const fetchLoginStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/social/login-status')
      if (response.ok) {
        const status = await response.json()
        setLoginStatus(status)
      }
    } catch (error) {
      console.error('[社交登入] 無法獲取登入狀態:', error)
    }
  }, [])

  // Fetch login status on mount and periodically
  useEffect(() => {
    fetchLoginStatus()
    const interval = setInterval(fetchLoginStatus, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [fetchLoginStatus])

  // 開啟社群平台登入頁面
  const handleLogin = async (platformId: string) => {
    // 改為顯示登入表單而非開啟外部頁面
    setShowLoginForm(platformId)
    // 同時展開教學指南，讓使用者可以同時看到說明和輸入欄位
    setExpandedGuide(platformId)
    setLoginError(null)
  }

  // 提交登入憑證
  const handleSubmitCredentials = async (platformId: string) => {
    setLoginLoading(platformId)
    setLoginError(null)

    try {
      let response

      if (platformId === 'gmail') {
        if (!gmailForm.email || !gmailForm.appPassword) {
          setLoginError('請填寫所有欄位')
          setLoginLoading(null)
          return
        }
        response = await fetch('/api/social/credentials/gmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: gmailForm.email,
            app_password: gmailForm.appPassword
          })
        })
      } else if (platformId === 'threads') {
        if (threadsLoginMode === 'simple') {
          // 簡單模式：使用帳號密碼
          if (!threadsBrowserForm.username || !threadsBrowserForm.password) {
            setLoginError('請填寫所有欄位')
            setLoginLoading(null)
            return
          }
          response = await fetch('/api/social/credentials/threads/browser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: threadsBrowserForm.username,
              password: threadsBrowserForm.password
            })
          })
        } else {
          // 進階模式：使用 API token
          if (!threadsForm.userId || !threadsForm.accessToken) {
            setLoginError('請填寫所有欄位')
            setLoginLoading(null)
            return
          }
          response = await fetch('/api/social/credentials/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: threadsForm.userId,
              access_token: threadsForm.accessToken
            })
          })
        }
      } else if (platformId === 'discord') {
        if (!discordForm.webhookUrl) {
          setLoginError('請填寫 Webhook URL')
          setLoginLoading(null)
          return
        }
        response = await fetch('/api/social/credentials/discord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhook_url: discordForm.webhookUrl
          })
        })
      }

      if (response && response.ok) {
        console.log(`[社交登入] ${platformId} 憑證已設定`)

        // Add delay to allow socket state to update
        await new Promise(resolve => setTimeout(resolve, 1000))

        setLoginStatus(prev => ({ ...prev, [platformId]: true }))
        setShowLoginForm(null)
        setExpandedGuide(null) // 關閉教學指南

        // Clear form
        if (platformId === 'gmail') setGmailForm({ email: '', appPassword: '' })
        if (platformId === 'threads') {
          setThreadsForm({ userId: '', accessToken: '' })
          setThreadsBrowserForm({ username: '', password: '' })
        }
        if (platformId === 'discord') setDiscordForm({ webhookUrl: '' })

        // Refresh login status with retry
        let retries = 3
        while (retries > 0) {
          try {
            await fetchLoginStatus()
            break
          } catch (error) {
            retries--
            if (retries === 0) {
              console.error(`[社交登入] 獲取狀態失敗:`, error)
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
      } else {
        const data = await response?.json()
        setLoginError(data?.detail || data?.message || '設定憑證失敗')
      }
    } catch (error) {
      setLoginError(`網路錯誤: ${error}`)
      console.error(`[社交登入] 錯誤:`, error)
    } finally {
      setLoginLoading(null)
    }
  }

  // 登出平台
  const handleLogout = async (platformId: string) => {
    setLoginLoading(`logout-${platformId}`)
    try {
      const response = await fetch(`/api/social/logout/${platformId}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        console.log(`[社交登入] 已登出 ${platformId}`)
        setLoginStatus(prev => ({ ...prev, [platformId]: false }))
        // Remove from enabled platforms if logged out
        if (localSettings.enabled_platforms.includes(platformId)) {
          setLocalSettings(prev => ({
            ...prev,
            enabled_platforms: prev.enabled_platforms.filter(p => p !== platformId)
          }))
          setHasChanges(true)
        }
      }
    } catch (error) {
      console.error(`[社交登入] 登出錯誤:`, error)
    } finally {
      setLoginLoading(null)
    }
  }

  useEffect(() => {
    // 只在使用者沒有未儲存變更時，才同步後端設定
    // 避免 WebSocket 頻繁更新覆蓋使用者的本地修改
    if (!hasChanges && settings) {
      setLocalSettings(settings)
    }
  }, [settings, hasChanges])

  const handlePlatformToggle = (platformId: string, checked: boolean) => {
    // Prevent enabling if not logged in
    if (checked && !loginStatus[platformId]) {
      setLoginError(`請先登入 ${platformId} 才能啟用此平台`)
      return
    }

    const newPlatforms = checked
      ? [...localSettings.enabled_platforms, platformId]
      : localSettings.enabled_platforms.filter(p => p !== platformId)

    setLocalSettings(prev => ({ ...prev, enabled_platforms: newPlatforms }))
    setHasChanges(true)
    setLoginError(null)
  }

  const handleMessageChange = (platform: string, message: string) => {
    setLocalSettings(prev => ({
      ...prev,
      custom_messages: { ...prev.custom_messages, [platform]: message }
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSave(localSettings)
    setHasChanges(false)
  }

  const handleAddRecipient = () => {
    if (newRecipient && newRecipient.includes('@')) {
      setLocalSettings(prev => ({
        ...prev,
        gmail_recipients: [...(prev.gmail_recipients || []), newRecipient]
      }))
      setNewRecipient('')
      setHasChanges(true)
    }
  }

  const handleRemoveRecipient = (email: string) => {
    setLocalSettings(prev => ({
      ...prev,
      gmail_recipients: (prev.gmail_recipients || []).filter(e => e !== email)
    }))
    setHasChanges(true)
  }

  const getPlatformById = (id: string) => {
    return PLATFORMS.find(p => p.id === id)
  }

  const renderGuideContent = (platformId: string) => {
    if (platformId === 'gmail') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">📧 如何取得 Gmail 應用程式密碼：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>前往 <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">Google 帳戶</a></li>
              <li>點擊「安全性」→「兩步驟驗證」（需先啟用）</li>
              <li>下滾至「應用程式密碼」</li>
              <li>選擇「郵件」和「其他裝置」</li>
              <li>輸入自訂名稱（如：IoT專注系統）</li>
              <li>複製產生的 16 位密碼</li>
            </ol>
          </div>
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
            <p className="text-yellow-300">💡 提示：應用程式密碼只會顯示一次，請妥善保存</p>
          </div>
        </div>
      )
    } else if (platformId === 'threads') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">🔧 進階模式 - 官方 API（推薦）：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>前往 <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">Meta for Developers</a></li>
              <li>建立應用程式（類型選擇「商業」）</li>
              <li>在應用程式中新增「Threads」產品</li>
              <li>前往「Threads API」→「開始使用」</li>
              <li>取得 User ID 和 Access Token</li>
              <li>將兩者貼入下方欄位</li>
            </ol>
          </div>
          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
            <p className="text-green-300">✅ 優點：100% 安全，不會被封鎖，長期穩定</p>
          </div>
          <div className="border-t border-border/30 pt-3 mt-3">
            <p className="font-semibold text-white mb-1">⚠️ 簡單模式 - 帳號密碼（有風險）：</p>
            <p className="text-red-300">使用 Instagram/Threads 帳號密碼登入，可能被偵測為機器人行為，建議僅用於測試。</p>
          </div>
        </div>
      )
    } else if (platformId === 'discord') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">🎮 如何取得 Discord Webhook URL：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>開啟 Discord，前往您要發送訊息的頻道</li>
              <li>點擊頻道設定（齒輪圖示）→「整合」</li>
              <li>點擊「建立 Webhook」或選擇現有 Webhook</li>
              <li>自訂 Webhook 名稱和頭像（可選）</li>
              <li>點擊「複製 Webhook URL」</li>
              <li>將 URL 貼入下方欄位</li>
            </ol>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
            <p className="text-blue-300">💡 提示：Webhook URL 格式為 https://discord.com/api/webhooks/...</p>
          </div>
        </div>
      )
    }
    return null
  }


  const renderPlatformCard = (platform: typeof PLATFORMS[0]) => {
    const isLoggedIn = loginStatus[platform.id] || false
    const isEnabled = localSettings.enabled_platforms.includes(platform.id)
    const showForm = showLoginForm === platform.id

    return (
      <div
        key={platform.id}
        className={`p-4 rounded-lg border transition-all ${isEnabled
          ? 'border-border bg-cyber-gray/50'
          : isLoggedIn
            ? 'border-border bg-cyber-gray/50 hover:border-muted-foreground'
            : 'border-yellow-500/50 bg-yellow-500/5'
          }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{platform.icon}</span>
            <div>
              <span className={`text-base font-medium ${platform.color} block`}>
                {platform.name}
              </span>
              <span className="text-xs text-muted-foreground">{platform.description}</span>
            </div>
          </div>
          <Badge
            variant={isLoggedIn ? "default" : "secondary"}
            className={`text-xs px-2 py-1 ${isLoggedIn
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}
          >
            {isLoggedIn ? (
              <><CheckCircle className="w-3 h-3 mr-1" />已設定</>
            ) : (
              <><XCircle className="w-3 h-3 mr-1" />未設定</>
            )}
          </Badge>
        </div>

        <div
          className={`flex items-center gap-3 py-2 px-2 rounded ${isLoggedIn ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed bg-yellow-500/10'}`}
          onClick={() => isLoggedIn && handlePlatformToggle(platform.id, !isEnabled)}
        >
          <Checkbox
            checked={isEnabled}
            disabled={!isLoggedIn}
            onCheckedChange={(checked) => handlePlatformToggle(platform.id, !!checked)}
          />
          <span className={`text-sm font-medium ${isLoggedIn ? 'text-white' : 'text-yellow-300'
            }`}>
            {isLoggedIn ? '啟用此平台' : '⚠️ 請先設定憑證才能啟用'}
          </span>
        </div>

        {/* 教學指南 - 未登入時顯示，開始設定時自動展開 */}
        {!isLoggedIn && (
          <div className="space-y-3 mt-4 pt-3 border-t border-border/50">
            <div>
              <button
                onClick={() => setExpandedGuide(expandedGuide === platform.id ? null : platform.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-blue-300">
                  <HelpCircle className="w-4 h-4" />
                  📖 {platform.name} 設定教學（點擊展開/收合）
                </span>
                {expandedGuide === platform.id ? (
                  <ChevronUp className="w-4 h-4 text-blue-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-blue-300" />
                )}
              </button>
              {expandedGuide === platform.id && (
                <div className="mt-3 p-4 bg-cyber-darker/50 rounded-lg border border-border/30 animate-in slide-in-from-top-2">
                  {renderGuideContent(platform.id)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 設定按鈕 - 只在未登入且未顯示表單時顯示 */}
        {!isLoggedIn && !showForm && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="text-sm h-9 px-3 flex-1 w-full sm:w-auto border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
              onClick={(e) => {
                e.stopPropagation()
                handleLogin(platform.id)
              }}
              disabled={loginLoading === platform.id}
            >
              <LogIn className="w-4 h-4 mr-2" />
              🔧 開始設定憑證
            </Button>
          </div>
        )}

        {/* 顯示登入表單 */}
        {showForm && (
          <div className="mt-4 pt-4 space-y-3 bg-cyber-darker/30 p-4 rounded-lg border border-blue-500/20">
            {platform.id === 'gmail' && (
              <>
                <div>
                  <Label className="text-sm mb-2 block text-white font-medium">Gmail 帳號</Label>
                  <Input
                    type="email"
                    value={gmailForm.email}
                    onChange={(e) => setGmailForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 block text-white font-medium">應用程式密碼</Label>
                  <Input
                    type="password"
                    value={gmailForm.appPassword}
                    onChange={(e) => setGmailForm(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder="應用程式密碼（16位）"
                  />
                  <p className="text-xs text-blue-300 mt-2 flex items-start gap-1">
                    <span>💡</span>
                    <span>在 Google 帳戶設定中生成應用程式密碼（參考上方教學）</span>
                  </p>
                </div>
              </>
            )}

            {platform.id === 'threads' && (
              <>
                {/* 重要安全提示 */}
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs space-y-1">
                      <p className="text-yellow-200 font-medium">⚠️ 安全建議</p>
                      <p className="text-yellow-200/80">
                        <strong className="text-yellow-300">推薦使用「進階模式」（官方 API）</strong><br />
                        • 簡單模式可能被 Meta 偵測為機器人<br />
                        • 有帳號被限制或封鎖的風險<br />
                        • 官方 API 是 100% 安全合法的方式
                      </p>
                    </div>
                  </div>
                </div>

                {/* 模式切換按鈕 */}
                <div className="flex items-center gap-2 p-2 bg-cyber-darker/50 rounded border border-border/30">
                  <button
                    onClick={() => setThreadsLoginMode('advanced')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded transition-all ${threadsLoginMode === 'advanced'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    ✅ 進階模式（推薦）
                  </button>
                  <button
                    onClick={() => setThreadsLoginMode('simple')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded transition-all ${threadsLoginMode === 'simple'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    ⚠️ 簡單模式（有風險）
                  </button>
                </div>

                {threadsLoginMode === 'simple' ? (
                  <>
                    {/* 簡單模式的額外警告 */}
                    <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-red-300">
                        <strong>⚠️ 風險警告：</strong>使用帳號密碼登入可能導致帳號被 Instagram/Threads 系統判定為機器人。
                        建議僅用於測試，或使用測試帳號。正式使用請選擇「進階模式」。
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block text-white font-medium">Instagram/Threads 帳號</Label>
                      <Input
                        type="text"
                        value={threadsBrowserForm.username}
                        onChange={(e) => setThreadsBrowserForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="用戶名 或 電子郵件"
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block text-white font-medium">密碼</Label>
                      <div className="relative">
                        <Input
                          type="password"
                          value={threadsBrowserForm.password}
                          onChange={(e) => setThreadsBrowserForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="密碼"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                            if (input) {
                              input.type = input.type === 'password' ? 'text' : 'password';
                            }
                          }}
                        >
                          👁️
                        </button>
                      </div>
                      <p className="text-xs text-red-300 mt-2 flex items-start gap-1">
                        <span>⚠️</span>
                        <span>不建議用於重要帳號（參考上方教學使用進階模式）</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded bg-green-500/10 border border-green-500/30 mb-2">
                      <p className="text-xs text-green-300">
                        ✅ <strong>安全推薦：</strong>使用 Meta 官方 API 是最安全的方式，不會有封鎖風險。
                        <a
                          href="https://developers.facebook.com/docs/threads"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline ml-1 hover:text-green-200"
                        >
                          查看設定教學
                        </a>
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block text-white font-medium">User ID</Label>
                      <Input
                        type="text"
                        value={threadsForm.userId}
                        onChange={(e) => setThreadsForm(prev => ({ ...prev, userId: e.target.value }))}
                        placeholder="Threads User ID"
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block text-white font-medium">Access Token</Label>
                      <Textarea
                        value={threadsForm.accessToken}
                        onChange={(e) => setThreadsForm(prev => ({ ...prev, accessToken: e.target.value }))}
                        placeholder="Threads API Access Token"
                        className="min-h-[80px]"
                      />
                      <p className="text-xs text-green-300 mt-2 flex items-start gap-1">
                        <span>✅</span>
                        <span>官方認可方式，安全可靠，從 Meta Developer 後台取得（參考上方教學）</span>
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {platform.id === 'discord' && (
              <div>
                <Label className="text-sm mb-2 block text-white font-medium">Webhook URL</Label>
                <Textarea
                  value={discordForm.webhookUrl}
                  onChange={(e) => setDiscordForm({ webhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="min-h-[80px]"
                />
                <p className="text-xs text-blue-300 mt-2 flex items-start gap-1">
                  <span>💡</span>
                  <span>在 Discord 頻道設定中建立 Webhook（參考上方教學）</span>
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleSubmitCredentials(platform.id)}
                disabled={loginLoading === platform.id}
                className="flex-1"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                {loginLoading === platform.id ? '設定中...' : '確認設定'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowLoginForm(null)
                  setExpandedGuide(null)
                  // 清理表單
                  if (platform.id === 'gmail') setGmailForm({ email: '', appPassword: '' })
                  if (platform.id === 'threads') {
                    setThreadsForm({ userId: '', accessToken: '' })
                    setThreadsBrowserForm({ username: '', password: '' })
                  }
                  if (platform.id === 'discord') setDiscordForm({ webhookUrl: '' })
                }}
                disabled={loginLoading === platform.id}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {/* 已登入時的操作區域：顯示成功提示和登出按鈕 */}
        {isLoggedIn && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
            {/* 成功提示 */}
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-green-300 font-medium">✅ {platform.name} 已成功設定</p>
                <p className="text-xs text-green-300/70 mt-0.5">您可以在上方勾選「啟用此平台」來開啟功能</p>
              </div>
            </div>

            {/* 登出按鈕 */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-sm h-9 px-3 w-full text-red-400 border-red-400/50 hover:bg-red-400/10"
                onClick={(e) => {
                  e.stopPropagation()
                  handleLogout(platform.id)
                }}
                disabled={loginLoading === `logout-${platform.id}`}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loginLoading === `logout-${platform.id}` ? '登出中...' : '🔓 登出並清除憑證'}
              </Button>
            </div>

            {/* 重新設定提示 */}
            <p className="text-xs text-muted-foreground/70 italic">
              💡 提示：如需重新設定憑證，請先登出後再進行設定
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="cyber-card border-neon-red/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-neon-red">
          <Skull className="w-5 h-5" />
          <span className="uppercase tracking-wider font-chinese">社死協定設定</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground font-chinese">
          設定違規時將發佈羞恥貼文的平台 - 依 App 分類管理
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 直接 API 整合資訊 */}
        <div className="bg-cyber-darker/50 border border-neon-blue/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-neon-blue mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground font-chinese">
                💡 <strong className="text-neon-blue">直接在網頁設定憑證</strong>
              </p>
              <p className="text-xs text-muted-foreground/70 font-chinese">
                點擊「設定憑證」按鈕，輸入各平台的 API 認證資訊。系統會自動儲存，下次啟動時自動載入。
              </p>
            </div>
          </div>
        </div>

        {loginError && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{loginError}</span>
            <button
              onClick={() => setLoginError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        <Tabs defaultValue="discord" className="w-full">
          <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-3 bg-cyber-gray/50 pb-1 sm:pb-0 scrollbar-hide">
            <TabsTrigger value="discord" className="flex items-center gap-1 px-3 sm:px-2 min-w-[60px]">
              <DiscordIcon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Discord</span>
            </TabsTrigger>
            <TabsTrigger value="gmail" className="flex items-center gap-1 px-3 sm:px-2 min-w-[60px]">
              <GmailIcon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Gmail</span>
            </TabsTrigger>
          </TabsList>

          {/* Discord Tab */}
          <TabsContent value="discord" className="space-y-4">
            <div className="space-y-4">
              {getPlatformById('discord') && renderPlatformCard(getPlatformById('discord')!)}
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground font-chinese mb-2 block">自訂訊息</Label>
                <Textarea
                  value={localSettings.custom_messages['discord'] || DEFAULT_MESSAGES['discord']}
                  onChange={(e) => handleMessageChange('discord', e.target.value)}
                  placeholder="輸入 Discord 訊息..."
                  className="min-h-[100px] bg-[#1a1a1a] border-border/70 font-chinese text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          </TabsContent>

          {/* Gmail Tab */}
          <TabsContent value="gmail" className="space-y-4">
            <div className="space-y-4">
              {getPlatformById('gmail') && renderPlatformCard(getPlatformById('gmail')!)}

              <div className="mt-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground font-chinese mb-2 block">收件人列表</Label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      type="email"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      placeholder="輸入電子郵件地址..."
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddRecipient}
                      disabled={!newRecipient || !newRecipient.includes('@')}
                    >
                      新增
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(localSettings.gmail_recipients || []).map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="px-3 py-1 bg-cyber-gray/50 text-sm dark:bg-gray-100 dark:text-gray-800"
                      >
                        {email}
                        <button
                          onClick={() => handleRemoveRecipient(email)}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {(!localSettings.gmail_recipients || localSettings.gmail_recipients.length === 0) && (
                      <span className="text-xs text-muted-foreground">尚未新增收件人</span>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-chinese mb-2 block">自訂郵件內容</Label>
                  <Textarea
                    value={localSettings.custom_messages['gmail'] || DEFAULT_MESSAGES['gmail']}
                    onChange={(e) => handleMessageChange('gmail', e.target.value)}
                    placeholder="輸入郵件內容..."
                    className="min-h-[100px] bg-[#1a1a1a] border-border/70 font-chinese text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-chinese">包含時間戳</Label>
              <p className="text-xs text-muted-foreground font-chinese">
                在貼文中加入違規時間
              </p>
            </div>
            <Switch
              checked={localSettings.include_timestamp}
              onCheckedChange={(checked) => {
                setLocalSettings(prev => ({ ...prev, include_timestamp: checked }))
                setHasChanges(true)
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-chinese">包含違規次數</Label>
              <p className="text-xs text-muted-foreground font-chinese">
                顯示你失敗了幾次
              </p>
            </div>
            <Switch
              checked={localSettings.include_violation_count}
              onCheckedChange={(checked) => {
                setLocalSettings(prev => ({ ...prev, include_violation_count: checked }))
                setHasChanges(true)
              }}
            />
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="w-full font-chinese"
          variant={hasChanges ? "default" : "outline"}
        >
          <Save className="w-4 h-4 mr-2" />
          {hasChanges ? '儲存變更' : '無變更'}
        </Button>
      </CardContent>
    </Card>
  )
}
