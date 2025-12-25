/**
 * 社交平台與處罰協定設定 (SocialSettings)
 * 負責設定違規時用於「公開處刑」的社群平台憑證與訊息內容。
 * 支援 Discord (Webhook) 與 Gmail (App Password)。
 * 核心邏輯包括憑證存儲、登入狀態查詢、以及各平台特定的自定義訊息設定。
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skull, Save, LogIn, KeyRound, LogOut, CheckCircle, XCircle, AlertCircle, X, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

import { DiscordIcon, GmailIcon } from '@/components/Icons'
import { api } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'

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

// 定義支援的社交平台及其基本屬性
// 定義支援的社交平台及其基本屬性
const PLATFORMS = [
  { id: 'discord', name: 'Discord', icon: <DiscordIcon className="w-6 h-6" />, color: 'text-indigo-400', descriptionKey: 'socialSettings.discordWebhook' },
  { id: 'gmail', name: 'Gmail', icon: <GmailIcon className="w-6 h-6" />, color: 'text-red-400', descriptionKey: 'socialSettings.email' },
]



export function SocialSettings({ settings, onSave }: SocialSettingsProps) {
  const { t } = useLanguage()
  const [localSettings, setLocalSettings] = useState<PenaltySettings>(settings)
  const [hasChanges, setHasChanges] = useState(false)
  const [loginLoading, setLoginLoading] = useState<string | null>(null)
  const [loginStatus, setLoginStatus] = useState<Record<string, boolean>>({})
  const [loginError, setLoginError] = useState<string | null>(null)
  const [newRecipient, setNewRecipient] = useState<string>('')
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)
  // 追蹤正在登出的平台，用於暫停輪詢避免狀態覆蓋
  const [isLoggingOut, setIsLoggingOut] = useState<string | null>(null)
  // 追蹤正在登入的平台，用於暫停輪詢避免狀態覆蓋
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null)

  // 管理各類登入表單的狀態
  const [showLoginForm, setShowLoginForm] = useState<string | null>(null)
  const [gmailForm, setGmailForm] = useState({ email: '', appPassword: '' })
  const [threadsForm, setThreadsForm] = useState({ userId: '', accessToken: '' })
  const [threadsBrowserForm, setThreadsBrowserForm] = useState({ username: '', password: '' })
  const [threadsLoginMode, setThreadsLoginMode] = useState<'simple' | 'advanced'>('advanced')
  const [discordForm, setDiscordForm] = useState({ webhookUrl: '' })

  // 從後端 API 同步各平台的登入/憑證設定狀態
  const fetchLoginStatus = useCallback(async () => {
    try {
      const status = await api.get<Record<string, boolean>>('/api/social/login-status')
      setLoginStatus(status)
    } catch (error) {
      console.error('[社交登入] 無法獲取登入狀態:', error)
    }
  }, [])

  // 元件掛載時執行，並每 10 秒自動輪詢一次，確保 UI 狀態與伺服器一致
  // 登入/登出期間暫停輪詢，避免覆蓋樂觀更新的狀態
  useEffect(() => {
    fetchLoginStatus()
    const interval = setInterval(() => {
      if (!isLoggingOut && !isLoggingIn) {
        fetchLoginStatus()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchLoginStatus, isLoggingOut, isLoggingIn])

  // 處理點擊登入：顯示表單並同步展開對應的教學指南
  const handleLogin = async (platformId: string) => {
    setShowLoginForm(platformId)
    setExpandedGuide(platformId)
    setLoginError(null)
  }

  // 提交憑證至伺服器
  const handleSubmitCredentials = async (platformId: string) => {
    setLoginLoading(platformId)
    setLoginError(null)
    // 標記正在登入，暫停輪詢避免狀態被覆蓋
    setIsLoggingIn(platformId)

    try {
      if (platformId === 'gmail') {
        if (!gmailForm.email || !gmailForm.appPassword) {
          setLoginError(t('socialSettings.alertFillAll'))
          setLoginLoading(null)
          setIsLoggingIn(null)
          return
        }
        await api.post('/api/social/credentials/gmail', {
          email: gmailForm.email,
          app_password: gmailForm.appPassword
        })
      } else if (platformId === 'threads') {
        if (threadsLoginMode === 'simple') {
          // 簡單模式（即將廢棄）：直接使用帳號密碼，模擬網頁行為
          if (!threadsBrowserForm.username || !threadsBrowserForm.password) {
            setLoginError('請填寫所有欄位')
            setLoginLoading(null)
            setIsLoggingIn(null)
            return
          }
          await api.post('/api/social/credentials/threads/browser', {
            username: threadsBrowserForm.username,
            password: threadsBrowserForm.password
          })
        } else {
          // 進階模式（推薦）：使用官方 API Token，安全性更高且穩定
          if (!threadsForm.userId || !threadsForm.accessToken) {
            setLoginError('請填寫所有欄位')
            setLoginLoading(null)
            setIsLoggingIn(null)
            return
          }
          await api.post('/api/social/credentials/threads', {
            user_id: threadsForm.userId,
            access_token: threadsForm.accessToken
          })
        }
      } else if (platformId === 'discord') {
        if (!discordForm.webhookUrl) {
          setLoginError(t('socialSettings.alertFillWebhook'))
          setLoginLoading(null)
          setIsLoggingIn(null)
          return
        }
        await api.post('/api/social/credentials/discord', {
          webhook_url: discordForm.webhookUrl
        })
      }

      console.log(`[社交登入] ${platformId} 憑證已設定`)

      // 樂觀更新：立即假設設定成功，提升 UI 反應速度
      setLoginStatus(prev => ({ ...prev, [platformId]: true }))
      setShowLoginForm(null)
      setExpandedGuide(null)

      // 重置表單狀態
      if (platformId === 'gmail') setGmailForm({ email: '', appPassword: '' })
      if (platformId === 'threads') {
        setThreadsForm({ userId: '', accessToken: '' })
        setThreadsBrowserForm({ username: '', password: '' })
      }
      if (platformId === 'discord') setDiscordForm({ webhookUrl: '' })
    } catch (error) {
      setLoginError(t('socialSettings.alertNetworkError', { error: String(error) }))
      console.error(`[社交登入] 錯誤:`, error)
    } finally {
      setLoginLoading(null)
      // 延遲清除登入標記，確保狀態穩定後才恢復輪詢
      setTimeout(() => {
        setIsLoggingIn(null)
      }, 1000)
    }
  }

  // 處理登出：清除伺服器端存儲的加密憑證檔案
  const handleLogout = async (platformId: string) => {
    setLoginLoading(`logout-${platformId}`)
    // 標記正在登出，暫停輪詢避免狀態被覆蓋
    setIsLoggingOut(platformId)

    // 樂觀更新：立即假設登出成功，提升 UI 反應速度
    // setLoginStatus(prev => ({ ...prev, [platformId]: false }))

    // 自動從啟用平台列表中移除
    setLocalSettings(prev => ({
      ...prev,
      enabled_platforms: prev.enabled_platforms.filter(p => p !== platformId)
    }))
    setHasChanges(true)

    try {
      const data = await api.post<{ success: boolean }>(`/api/social/logout/${platformId}`)
      if (data.success) {
        console.log(`[社交登入] 已登出 ${platformId}`)
      } else {
        // 如果後端返回失敗（極少見），恢復狀態
        console.warn(`[社交登入] 登出失敗，正在恢復狀態`)
        setLoginStatus(prev => ({ ...prev, [platformId]: true }))
      }
    } catch (error) {
      console.error(`[社交登入] 登出錯誤:`, error)
      // 發生錯誤時恢復狀態
      setLoginStatus(prev => ({ ...prev, [platformId]: true }))
    } finally {
      setLoginLoading(null)
      // 延遲清除登出標記，確保狀態穩定後才恢復輪詢
      setTimeout(() => {
        setIsLoggingOut(null)
      }, 1000)
    }
  }

  useEffect(() => {
    // 樂觀鎖機制：只在使用者沒有未儲存變更時，才從後端同步設定。
    // 避免 WebSocket 背景推送覆蓋掉使用者正在編輯的內容。
    if (!hasChanges && settings) {
      setLocalSettings(settings)
    }
  }, [settings, hasChanges])

  // 自動同步 enabled_platforms：綁定憑證即視為啟用該平台
  // 登入/登出期間不執行同步，避免狀態快速切換
  useEffect(() => {
    // 如果正在登出或登入，跳過同步
    if (isLoggingOut || isLoggingIn) {
      return
    }

    const enabledPlatforms = Object.entries(loginStatus)
      .filter(([, isLoggedIn]) => isLoggedIn)
      .map(([platform]) => platform)

    // 只有當平台列表有變化時才更新
    const currentEnabled = [...localSettings.enabled_platforms].sort().join(',')
    const newEnabled = [...enabledPlatforms].sort().join(',')

    if (currentEnabled !== newEnabled) {
      setLocalSettings(prev => ({
        ...prev,
        enabled_platforms: enabledPlatforms
      }))
      setHasChanges(true)
    }
  }, [loginStatus, isLoggingOut, isLoggingIn])

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

  // 渲染各平台的教學指南內容，引導使用者完成複雜的 API/Webhook 設定
  const renderGuideContent = (platformId: string) => {
    if (platformId === 'gmail') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">{t('socialSettings.guideGmailPassword')}</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li><span dangerouslySetInnerHTML={{ __html: t('socialSettings.guideGmailStep1') }} /></li>
              <li>{t('socialSettings.guideGmailStep2')}</li>
              <li>{t('socialSettings.guideGmailStep3')}</li>
              <li>{t('socialSettings.guideGmailStep4')}</li>
              <li>{t('socialSettings.guideGmailStep5')}</li>
              <li>{t('socialSettings.guideGmailStep6')}</li>
            </ol>
          </div>
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
            <p className="text-yellow-300">{t('socialSettings.guideGmailTip')}</p>
          </div>
        </div>
      )
    } else if (platformId === 'threads') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">進階模式 - 官方 API（推薦）：</p>
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
            <p className="text-green-300">優點：100% 安全，不會被封鎖，長期穩定</p>
          </div>
          <div className="border-t border-border/30 pt-3 mt-3">
            <p className="font-semibold text-white mb-1">簡單模式 - 帳號密碼（有風險）：</p>
            <p className="text-red-300">使用 Instagram/Threads 帳號密碼登入，可能被偵測為機器人行為，建議僅用於測試。</p>
          </div>
        </div>
      )
    } else if (platformId === 'discord') {
      return (
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-white mb-1">{t('socialSettings.guideDiscordWebhook')}</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>{t('socialSettings.guideDiscordStep1')}</li>
              <li>{t('socialSettings.guideDiscordStep2')}</li>
              <li>{t('socialSettings.guideDiscordStep3')}</li>
              <li>{t('socialSettings.guideDiscordStep4')}</li>
              <li>{t('socialSettings.guideDiscordStep5')}</li>
              <li>{t('socialSettings.guideDiscordStep6')}</li>
            </ol>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
            <p className="text-blue-300">{t('socialSettings.guideDiscordTip')}</p>
          </div>
        </div>
      )
    }
    return null
  }

  // 渲染單個平台的卡片 UI，整合狀態顯示與設定按鈕
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
              <span className="text-xs text-muted-foreground">{t(platform.descriptionKey)}</span>
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
              <><CheckCircle className="w-3 h-3 mr-1" />{t('socialSettings.configured')}</>
            ) : (
              <><XCircle className="w-3 h-3 mr-1" />{t('socialSettings.notConfigured')}</>
            )}
          </Badge>
        </div>



        {/* 若未登入，顯示展開式教學指南，引導使用者完成初步設定 */}
        {!isLoggedIn && (
          <div className="space-y-3 mt-4 pt-3 border-t border-border/50">
            <div>
              <button
                onClick={() => setExpandedGuide(expandedGuide === platform.id ? null : platform.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-blue-300">
                  <HelpCircle className="w-4 h-4" />
                  {t('socialSettings.setupGuideExpand', { platform: platform.name })}
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

        {/* 設定按鈕 - 觸發對應平台的登入表單顯示 */}
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
              {t('socialSettings.startSetup')}
            </Button>
          </div>
        )}

        {/* 平台特定的登入表單：Gmail、Threads 或 Discord */}
        {showForm && (
          <div className="mt-4 pt-4 space-y-3 bg-cyber-darker/30 p-4 rounded-lg border border-blue-500/20">
            {platform.id === 'gmail' && (
              <>
                <div>
                  <Label className="text-sm mb-2 block text-white font-medium">{t('socialSettings.gmailAccount')}</Label>
                  <Input
                    type="email"
                    value={gmailForm.email}
                    onChange={(e) => setGmailForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 block text-white font-medium">{t('socialSettings.appPassword')}</Label>
                  <Input
                    type="password"
                    value={gmailForm.appPassword}
                    onChange={(e) => setGmailForm(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder={t('socialSettings.appPasswordPlaceholder')}
                  />
                  <p className="text-xs text-blue-300 mt-2 flex items-start gap-1">
                    <span>{t('socialSettings.appPasswordHint')}</span>
                  </p>
                </div>
              </>
            )}

            {platform.id === 'threads' && (
              <>
                {/* Threads 模式切換與安全警示 */}
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs space-y-1">
                      <p className="text-yellow-200 font-medium">安全建議</p>
                      <p className="text-yellow-200/80">
                        <strong className="text-yellow-300">推薦使用「進階模式」（官方 API）</strong><br />
                        • 簡單模式可能被 Meta 偵測為機器人<br />
                        • 有帳號被限制或封鎖的風險<br />
                        • 官方 API 是 100% 安全合法的方式
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-cyber-darker/50 rounded border border-border/30">
                  <button
                    onClick={() => setThreadsLoginMode('advanced')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded transition-all ${threadsLoginMode === 'advanced'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    進階模式（推薦）
                  </button>
                  <button
                    onClick={() => setThreadsLoginMode('simple')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded transition-all ${threadsLoginMode === 'simple'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    簡單模式（有風險）
                  </button>
                </div>

                {threadsLoginMode === 'simple' ? (
                  <>
                    <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-red-300">
                        <strong>風險警告：</strong>使用帳號密碼登入可能導致帳號被 Instagram/Threads 系統判定為機器人。
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
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded bg-green-500/10 border border-green-500/30 mb-2">
                      <p className="text-xs text-green-300">
                        <strong>安全推薦：</strong>使用 Meta 官方 API 是最安全的方式。
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
                    </div>
                  </>
                )}
              </>
            )}

            {platform.id === 'discord' && (
              <div>
                <Label className="text-sm mb-2 block text-white font-medium">{t('socialSettings.webhookUrl')}</Label>
                <Textarea
                  value={discordForm.webhookUrl}
                  onChange={(e) => setDiscordForm({ webhookUrl: e.target.value })}
                  placeholder={t('socialSettings.webhookPlaceholder')}
                  className="min-h-[80px]"
                />
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
                {t('socialSettings.confirmSetup')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowLoginForm(null)
                  setExpandedGuide(null)
                }}
                disabled={loginLoading === platform.id}
              >
                {t('socialSettings.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* 已登入且設定成功後的完成指示與登出入口 */}
        {isLoggedIn && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3">


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
                {t('socialSettings.logoutAndClear')}
              </Button>
            </div>
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
          <span className="uppercase tracking-wider font-chinese">{t('socialSettings.title')}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground font-chinese">
          {t('socialSettings.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">


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

          {/* Discord Tab：訊息編輯 */}
          <TabsContent value="discord" className="space-y-4">
            <div className="space-y-4">
              {getPlatformById('discord') && renderPlatformCard(getPlatformById('discord')!)}
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground font-chinese mb-2 block">{t('socialSettings.customMessage')}</Label>
                <Textarea
                  value={localSettings.custom_messages['discord'] || t('socialSettings.defaultMessageDiscord')}
                  onChange={(e) => handleMessageChange('discord', e.target.value)}
                  placeholder={t('socialSettings.enterDiscordMessage')}
                  className="min-h-[100px] bg-[#1a1a1a] border-border/70 font-chinese text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          </TabsContent>

          {/* Gmail Tab：收件人與郵件内容 */}
          <TabsContent value="gmail" className="space-y-4">
            <div className="space-y-4">
              {getPlatformById('gmail') && renderPlatformCard(getPlatformById('gmail')!)}

              <div className="mt-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground font-chinese mb-2 block">{t('socialSettings.recipientList')}</Label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      type="email"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      placeholder={t('socialSettings.enterEmail')}
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddRecipient}
                      disabled={!newRecipient || !newRecipient.includes('@')}
                    >
                      {t('socialSettings.add')}
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
                      <span className="text-xs text-muted-foreground">{t('socialSettings.noRecipients')}</span>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-chinese mb-2 block">{t('socialSettings.customEmailContent')}</Label>
                  <Textarea
                    value={localSettings.custom_messages['gmail'] || t('socialSettings.defaultMessageGmail')}
                    onChange={(e) => handleMessageChange('gmail', e.target.value)}
                    placeholder={t('socialSettings.enterEmailContent')}
                    className="min-h-[100px] bg-[#1a1a1a] border-border/70 font-chinese text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 全域處罰選項：是否在貼文中附加時間與違規次數 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-chinese">{t('socialSettings.includeTimestamp')}</Label>
              <p className="text-xs text-muted-foreground font-chinese">
                {t('socialSettings.includeTimestampDesc')}
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
              <Label className="font-chinese">{t('socialSettings.includeViolationCount')}</Label>
              <p className="text-xs text-muted-foreground font-chinese">
                {t('socialSettings.includeViolationCountDesc')}
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

        {/* 儲存按鈕：僅在 localSettings 有變動時才可點擊 */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="w-full font-chinese"
          variant={hasChanges ? "default" : "outline"}
        >
          <Save className="w-4 h-4 mr-2" />
          {hasChanges ? t('socialSettings.saveChanges') : t('socialSettings.noChanges')}
        </Button>
      </CardContent>
    </Card>
  )
}
