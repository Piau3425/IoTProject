/**
 * 人質管理器 (HostageManager)
 * 負責「人質協定」的圖片管理邏輯。
 * 核心概念是讓使用者上傳一些「不可告人」或尷尬的照片作為專注的人質，
 * 一旦執法期間發生違規，系統會從選取的照片中隨機抽取並發佈到社交平台。
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, getApiBase } from '@/lib/api'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { ImageIcon, Upload, AlertTriangle, Trash2, Check, Maximize2, Loader2, CheckSquare, Square } from 'lucide-react'
import { HostageIcon } from '@/components/Icons'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'

interface HostageImage {
  id: string
  filename: string
  selected: boolean // 是否被勾選用於處罰隨機池
  url?: string
}

interface HostageListResponse {
  images: HostageImage[]
  total: number
  selected_count: number
}

interface HostageManagerProps {
  disabled?: boolean
}

export function HostageManager({ disabled }: HostageManagerProps) {
  const [dragActive, setDragActive] = useState(false)
  const [images, setImages] = useState<HostageImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [highlightManage, setHighlightManage] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useLanguage()


  // 從 API 獲取當前所有已上傳的人質圖片
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<HostageListResponse>('/api/hostage/images')
      setImages(data.images)
    } catch (error) {
      console.error('[人質協定] 載入圖片失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 元件掛載時初始化圖片列表
  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  // 處理檔案上傳邏輯（支援多圖上傳及格式過濾）
  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

    if (validFiles.length === 0) {
      alert(t('hostageManager.alertUploadImage'))
      return
    }

    // 系統限制：人質上限為 30 張，避免濫用伺服器儲存空間
    if (images.length + validFiles.length > 30) {
      alert(t('hostageManager.alertMaxPhotos', { count: images.length }))
      return
    }

    setUploading(true)

    try {
      // 逐一發送上傳請求
      for (const file of validFiles) {
        const formData = new FormData()
        formData.append('file', file)

        await api.post('/api/hostage/upload', formData)
      }

      // 上傳成功後重新更新列表並觸發提醒
      await fetchImages()
      setHighlightManage(true)
    } catch (error) {
      console.error('[人質協定] 上傳失敗:', error)
      alert(t('hostageManager.alertUploadFailed'))
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }, [images.length, fetchImages])


  // 處理拖放效果
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  // 切換單張圖片的「處罰啟用」狀態
  const toggleSelection = async (imageId: string) => {
    try {
      await api.post(`/api/hostage/toggle/${imageId}`)
      // 樂觀更新 UI，提升操作流暢感
      setImages(prev => prev.map(img => {
        if (img.id === imageId) {
          return { ...img, selected: !img.selected }
        }
        return img
      }))
    } catch (error) {
      console.error('[人質協定] 切換狀態失敗:', error)
      await fetchImages() // 出錯時同步回原始伺服器狀態
    }
  }

  const selectedCount = images.filter(img => img.selected).length
  const allSelected = images.length > 0 && selectedCount === images.length

  // 批量全選或取消全選
  const handleSelectAll = async () => {
    setProcessing(true)
    const targetState = !allSelected

    // 樂觀更新
    setImages(prev => prev.map(img => ({ ...img, selected: targetState })))

    try {
      // 找出需要改變狀態的圖片進行同步，序列化執行避免瞬時壓力
      const imagesToToggle = images.filter(img => img.selected !== targetState)

      for (const img of imagesToToggle) {
        await api.post(`/api/hostage/toggle/${img.id}`)
      }
    } catch (error) {
      console.error("Batch toggle failed", error)
      fetchImages() // 同步回原本狀態
    } finally {
      setProcessing(false)
    }
  }

  // 批量刪除選中的圖片
  const handleBulkDelete = async () => {
    const selected = images.filter(img => img.selected)
    if (selected.length === 0) return

    if (!confirm(t('hostageManager.confirmDelete', { count: selected.length }))) return

    setProcessing(true)

    try {
      for (const img of selected) {
        await api.delete(`/api/hostage/delete/${img.id}`)
      }
      await fetchImages() // 刷新列表
    } catch (error) {
      console.error("Batch delete failed", error)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="mac-card p-5 border-2 border-neon-purple/30">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="flex items-center gap-2 text-neon-purple text-sm font-semibold">
          <HostageIcon className="w-4 h-4" />
          <span className="uppercase tracking-wide">{t('hostageManager.protocolTitle')}</span>
        </CardTitle>
        <p className="text-xs text-mac-textSecondary mt-1">
          {t('hostageManager.description')}
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-cyber-gray/50">
            <TabsTrigger value="upload" className="text-xs flex items-center gap-2">
              <Upload className="w-3 h-3" />
              <span>{t('hostageManager.tabUpload')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="manage"
              className={cn(
                "text-xs flex items-center gap-2 transition-all duration-300",
                // 如果需要提醒，顯示呼吸燈效果
                highlightManage ? "delay-500 animate-[pulse_1.5s_ease-in-out_infinite] text-neon-yellow shadow-[0_0_10px_rgba(249,248,113,0.3)]" : ""
              )}
              onClick={() => setHighlightManage(false)}
            >
              <ImageIcon className="w-3 h-3" />
              <span>{t('hostageManager.tabManage')} ({images.length}/30)</span>
            </TabsTrigger>
          </TabsList>

          {/* 上傳 Tab 内容 */}
          <TabsContent value="upload" className="mt-4">
            <div
              role="button"
              tabIndex={0}
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer interactive
                ${dragActive
                  ? 'border-neon-purple bg-neon-purple/10 scale-105'
                  : 'border-white/20 hover:border-neon-purple/50 hover:bg-white/5'
                }
                ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !disabled && !uploading && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleChange}
                className="hidden"
                disabled={disabled || uploading}
              />
              <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
                <div className="w-14 h-14 rounded-full glass-light flex items-center justify-center">
                  <Upload className="w-7 h-7 text-mac-textSecondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-1">
                    {uploading ? t('hostageManager.uploading') : t('hostageManager.uploadDragDrop')}
                  </p>
                  <p className="text-xs text-mac-textSecondary">
                    {t('hostageManager.supportedFormats')}
                  </p>
                  <p className="text-xs text-neon-purple mt-2">
                    {t('hostageManager.uploadedCount', { count: images.length })}
                  </p>
                </div>
              </div>
            </div>

            {/* 若已上傳且有選取人質，顯示處罰池提醒 */}
            {images.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-neon-red flex-shrink-0" />
                  <div className="text-xs">
                    <p className="text-neon-red font-medium">
                      {t('hostageManager.selectionWarning', { count: selectedCount })}
                    </p>
                    <p className="text-neon-red/70 mt-0.5">
                      {t('hostageManager.selectionDesc')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 管理 Tab 内容 */}
          <TabsContent value="manage" className="mt-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('hostageManager.noPhotos')}</p>
                <p className="text-xs mt-1">{t('hostageManager.switchToUpload')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 批量操作工具列：全選、計數、刪除 */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={processing}
                      className="h-8 text-xs hover:bg-white/10"
                    >
                      {processing ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : allSelected ? (
                        <CheckSquare className="w-3 h-3 mr-1" />
                      ) : (
                        <Square className="w-3 h-3 mr-1" />
                      )}
                      {t('hostageManager.selectAll')}
                    </Button>
                    <span className="text-xs text-muted-foreground border-l border-white/10 pl-2">
                      {t('hostageManager.selectedCount', { count: selectedCount })}
                    </span>
                  </div>

                  {selectedCount > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={processing}
                      className="h-7 text-xs px-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {t('hostageManager.deleteSelected', { count: selectedCount })}
                    </Button>
                  )}
                </div>

                {/* 圖片網格展示組件 */}
                <SmoothGrid images={images} toggleSelection={toggleSelection} />

                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5" />
                  <p className="text-xs text-yellow-300">
                    {t('hostageManager.tip')}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-xs text-mac-textSecondary/60 text-center">
          {t('hostageManager.optionalNote')}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * 圖片網原子組件 (SmoothGrid)
 * 使用網格佈局展示人質圖片，並整合 Lenis 進行平滑彈性滾動優化。
 */
function SmoothGrid({ images, toggleSelection }: { images: HostageImage[], toggleSelection: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 追蹤 RAF ID 和 Lenis 實例以便正確清理
    let rafId: number | null = null
    let lenisInstance: InstanceType<typeof import('lenis').default> | null = null

    // 初始化 Lenis 滾動優化，讓圖片列表滾動更有質感與絲滑感
    import('lenis').then(({ default: Lenis }) => {
      lenisInstance = new Lenis({
        wrapper: container,
        content: container, // 設定內部滾動範圍
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      })

      function raf(time: number) {
        if (lenisInstance) {
          lenisInstance.raf(time)
          rafId = requestAnimationFrame(raf)
        }
      }
      rafId = requestAnimationFrame(raf)
    })

    // 確保組件卸載時正確清理 RAF 和 Lenis
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      if (lenisInstance) {
        lenisInstance.destroy()
        lenisInstance = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto pr-1"
      onWheel={(e) => e.stopPropagation()} // 防止滾動事件干擾父層主頁面
    >
      {images.map((image) => (
        <div
          key={image.id}
          className={`relative group rounded-md overflow-hidden border transition-all aspect-square ${image.selected
            ? 'border-neon-red shadow-glow-red ring-1 ring-neon-red/50'
            : 'border-border hover:border-white/30'
            }`}
        >
          {/* 圖片預覽區域：支援點擊放大 (Lightbox) */}
          <Dialog>
            <DialogTrigger asChild>
              <div className="w-full h-full cursor-zoom-in relative">
                {image.url ? (
                  <img
                    src={`${getApiBase()}${image.url}`}
                    alt="人質照片"
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-cyber-gray/50">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                {/* Hover 時呈現的毛玻璃遮罩 */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Maximize2 className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-black/90 border-white/10 p-1">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={image.url}
                  alt={image.filename}
                  className="max-w-full max-h-[80vh] object-contain rounded-sm"
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* 處罰選取狀態的視覺指示器 (右下角 Check) */}
          {image.selected && (
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-neon-red flex items-center justify-center shadow-sm z-10 pointer-events-none">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}

          {/* 快速切換選取狀態的 Checkbox (左上角) */}
          <div className="absolute top-1 left-1 z-10">
            <div
              className="w-5 h-5 rounded bg-black/40 backdrop-blur-md flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors border border-white/10"
              onClick={(e) => {
                e.stopPropagation()
                toggleSelection(image.id)
              }}
            >
              <Checkbox
                checked={image.selected}
                onCheckedChange={() => toggleSelection(image.id)}
                className="w-3.5 h-3.5 border-white/50 data-[state=checked]:bg-neon-red data-[state=checked]:border-neon-red"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
