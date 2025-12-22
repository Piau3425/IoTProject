import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { ImageIcon, Upload, AlertTriangle, Trash2, Check, Maximize2, Loader2, CheckSquare, Square } from 'lucide-react'
import { HostageIcon } from '@/components/Icons'

interface HostageImage {
  id: string
  filename: string
  selected: boolean
  url?: string
}

interface HostageManagerProps {
  disabled?: boolean
  sessionActive?: boolean
  onUploadComplete?: (files: string[]) => void
}

export function HostageManager({ disabled }: HostageManagerProps) {
  const [dragActive, setDragActive] = useState(false)
  const [images, setImages] = useState<HostageImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 從後端載入已上傳的圖片列表
  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/hostage/images')
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      }
    } catch (error) {
      console.error('[人質管理] 載入圖片列表失敗:', error)
    }
  }

  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

    if (validFiles.length === 0) {
      alert('請上傳圖片檔案')
      return
    }

    // 檢查是否超過 30 張
    if (images.length + validFiles.length > 30) {
      alert(`最多只能上傳 30 張照片（目前已有 ${images.length} 張）`)
      return
    }

    setUploading(true)

    try {
      for (const file of validFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/hostage/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`上傳失敗: ${file.name}`)
        }
      }

      // 重新載入圖片列表
      await fetchImages()
    } catch (error) {
      console.error('[人質管理] 上傳失敗:', error)
      alert('部分圖片上傳失敗，請重試')
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }, [images.length])

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

  const toggleSelection = async (imageId: string) => {
    // Optimistic update
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, selected: !img.selected } : img
    ))

    try {
      await fetch(`/api/hostage/toggle/${imageId}`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('[人質管理] 切換選取失敗:', error)
      // Revert on failure
      fetchImages()
    }
  }

  const selectedCount = images.filter(img => img.selected).length
  const allSelected = images.length > 0 && selectedCount === images.length

  const handleSelectAll = async () => {
    setProcessing(true)
    const targetState = !allSelected

    // Optimistic UI update
    setImages(prev => prev.map(img => ({ ...img, selected: targetState })))

    try {
      // Find images that need status change
      const imagesToToggle = images.filter(img => img.selected !== targetState)

      // Execute sequentially to avoid overwhelming server (simple implementation)
      for (const img of imagesToToggle) {
        await fetch(`/api/hostage/toggle/${img.id}`, { method: 'POST' })
      }
    } catch (error) {
      console.error("Batch toggle failed", error)
      fetchImages() // Sync on error
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkDelete = async () => {
    const selected = images.filter(img => img.selected)
    if (selected.length === 0) return

    if (!confirm(`確定要刪除選取的 ${selected.length} 張照片嗎？此動作無法復原。`)) return

    setProcessing(true)

    try {
      // Execute sequentially
      for (const img of selected) {
        await fetch(`/api/hostage/delete/${img.id}`, { method: 'DELETE' })
      }
      // Refresh list
      await fetchImages()
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
          <span className="uppercase tracking-wide">人質協定</span>
        </CardTitle>
        <p className="text-xs text-mac-textSecondary mt-1">
          上傳尷尬照片作為人質，違規時將隨機公開處刑
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-cyber-gray/50">
            <TabsTrigger value="upload" className="text-xs">
              📤 上傳照片
            </TabsTrigger>
            <TabsTrigger value="manage" className="text-xs">
              🗂️ 管理照片 ({images.length}/30)
            </TabsTrigger>
          </TabsList>

          {/* 上傳 Tab */}
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
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full glass-light flex items-center justify-center">
                  <Upload className="w-7 h-7 text-mac-textSecondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-1">
                    {uploading ? '上傳中...' : '拖放或點擊上傳人質照片'}
                  </p>
                  <p className="text-xs text-mac-textSecondary">
                    支援 JPG、PNG、GIF 格式，最多 30 張
                  </p>
                  <p className="text-xs text-neon-purple mt-2">
                    目前已上傳：{images.length}/30 張
                  </p>
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-neon-red flex-shrink-0" />
                  <div className="text-xs">
                    <p className="text-neon-red font-medium">
                      已選取 {selectedCount} 張照片用於處罰
                    </p>
                    <p className="text-neon-red/70 mt-0.5">
                      違規時將從選取的照片中隨機選擇一張公開
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 管理 Tab */}
          <TabsContent value="manage" className="mt-4">
            {images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">尚未上傳任何照片</p>
                <p className="text-xs mt-1">請切換到「上傳照片」頁面</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 批量操作工具列 */}
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
                      全選
                    </Button>
                    <span className="text-xs text-muted-foreground border-l border-white/10 pl-2">
                      已選 {selectedCount}
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
                      刪除選取 ({selectedCount})
                    </Button>
                  )}
                </div>

                {/* 圖片網格 */}
                {/* Fix: Added stopPropagation to wheel event to prevent parent scroll interference */}
                <SmoothGrid images={images} toggleSelection={toggleSelection} />

                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs text-yellow-300">
                    💡 提示：點擊圖片可放大檢視。請至少選取一張照片，違規時系統會從選取的照片中隨機挑選
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-xs text-mac-textSecondary/60 text-center">
          （可選）不上傳照片將僅發布文字懲罰
        </p>
      </CardContent>
    </Card>
  )
}

// Sub-component for smooth grid to keep main component clean
function SmoothGrid({ images, toggleSelection }: { images: HostageImage[], toggleSelection: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Dynamic import to avoid SSR issues if any (though this is SPA)
    import('lenis').then(({ default: Lenis }) => {
      const lenis = new Lenis({
        wrapper: container,
        content: container, // Self-contained scroll
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      })

      function raf(time: number) {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }
      requestAnimationFrame(raf)

      // Cleanup
      return () => {
        lenis.destroy()
      }
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto pr-1"
      onWheel={(e) => e.stopPropagation()}
    >
      {images.map((image) => (
        <div
          key={image.id}
          className={`relative group rounded-md overflow-hidden border transition-all aspect-square ${image.selected
            ? 'border-neon-red shadow-glow-red ring-1 ring-neon-red/50'
            : 'border-border hover:border-white/30'
            }`}
        >
          {/* 圖片預覽 & Lightbox Trigger */}
          <Dialog>
            <DialogTrigger asChild>
              <div className="w-full h-full cursor-zoom-in relative">
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-cyber-gray/50">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                {/* Hover Overlay */}
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
                {/* Filename overlay removed as requested */}
              </div>
            </DialogContent>
          </Dialog>

          {/* 選取狀態指示器 */}
          {image.selected && (
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-neon-red flex items-center justify-center shadow-sm z-10 pointer-events-none">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}

          {/* 快速選取 Checkbox (左上角) */}
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
