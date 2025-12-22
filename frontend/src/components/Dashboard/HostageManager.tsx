import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageIcon, Upload, AlertTriangle, Shield, Trash2, Check } from 'lucide-react'

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

export function HostageManager({ disabled, sessionActive, onUploadComplete }: HostageManagerProps) {
  const [dragActive, setDragActive] = useState(false)
  const [images, setImages] = useState<HostageImage[]>([])
  const [uploading, setUploading] = useState(false)
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
    try {
      const response = await fetch(`/api/hostage/toggle/${imageId}`, {
        method: 'POST',
      })

      if (response.ok) {
        setImages(prev => prev.map(img => 
          img.id === imageId ? { ...img, selected: !img.selected } : img
        ))
      }
    } catch (error) {
      console.error('[人質管理] 切換選取失敗:', error)
    }
  }

  const deleteImage = async (imageId: string) => {
    if (!confirm('確定要刪除這張照片嗎？')) return

    try {
      const response = await fetch(`/api/hostage/delete/${imageId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== imageId))
      }
    } catch (error) {
      console.error('[人質管理] 刪除失敗:', error)
    }
  }

  const selectedCount = images.filter(img => img.selected).length

  return (
    <Card className="mac-card p-5 border-2 border-neon-purple/30">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="flex items-center gap-2 text-neon-purple text-sm font-semibold">
          <Shield className="w-4 h-4" />
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
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer
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
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    已選取 {selectedCount} / {images.length} 張照片
                  </span>
                  <span className="text-neon-purple">
                    處罰時隨機使用選取的照片
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                        image.selected
                          ? 'border-neon-red shadow-glow-red'
                          : 'border-border hover:border-neon-purple/50'
                      }`}
                    >
                      {/* 圖片預覽 */}
                      <div className="aspect-square bg-cyber-gray/50 relative">
                        {image.url ? (
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* 選取標記 */}
                        {image.selected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-neon-red flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* 懸停時顯示操作按鈕 */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant={image.selected ? "default" : "outline"}
                            className="h-8 px-3 text-xs"
                            onClick={() => toggleSelection(image.id)}
                          >
                            {image.selected ? '已選取' : '選取'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-400 hover:bg-red-400/20"
                            onClick={() => deleteImage(image.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 檔名 */}
                      <div className="p-2 bg-cyber-darker/80">
                        <p className="text-xs text-white truncate" title={image.filename}>
                          {image.filename}
                        </p>
                      </div>

                      {/* 快速選取checkbox */}
                      <div className="absolute top-2 left-2">
                        <div
                          className="w-5 h-5 rounded bg-black/50 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelection(image.id)
                          }}
                        >
                          <Checkbox
                            checked={image.selected}
                            onCheckedChange={() => toggleSelection(image.id)}
                            className="w-3.5 h-3.5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs text-yellow-300">
                    💡 提示：請至少選取一張照片，違規時系統會從選取的照片中隨機挑選
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
