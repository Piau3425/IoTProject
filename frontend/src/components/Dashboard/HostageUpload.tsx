import { useState, useRef, useCallback } from 'react'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImageIcon, Upload, X, AlertTriangle, Shield } from 'lucide-react'

interface HostageUploadProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  disabled?: boolean
}

export function HostageUpload({ onFileSelect, selectedFile, disabled }: HostageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File | null) => {
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('請上傳圖片檔案')
        return
      }
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelect(file)
    } else {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      onFileSelect(null)
    }
  }, [onFileSelect, previewUrl])

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }, [handleFile])

  const clearFile = useCallback(() => {
    handleFile(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [handleFile])

  return (
    <div className={`mac-card p-5 border-2 ${dragActive ? 'border-neon-purple/50 glow-blue' : 'border-neon-purple/30'} interactive`}>
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-neon-purple text-sm font-semibold mb-1">
          <Shield className="w-4 h-4" />
          <span className="uppercase tracking-wide">人質協定</span>
        </h3>
        <p className="text-xs text-mac-textSecondary">
          上傳一張尷尬照片作為人質，違規時將被公開處刑
        </p>
      </div>

      <div>
        {!selectedFile ? (
          <div
            className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer
              ${dragActive
                ? 'border-neon-purple bg-neon-purple/10 scale-105'
                : 'border-white/20 hover:border-neon-purple/50 hover:bg-white/5'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="hidden"
              disabled={disabled}
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full glass-light flex items-center justify-center">
                <Upload className="w-7 h-7 text-mac-textSecondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">
                  拖放或點擊上傳人質照片
                </p>
                <p className="text-xs text-mac-textSecondary">
                  支援 JPG、PNG、GIF 格式
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative animate-scale-in">
            <div className="relative rounded-xl overflow-hidden border-2 border-neon-red/50 shadow-glow-red">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="人質預覽"
                  className="w-full h-36 object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ImageIcon className="w-4 h-4 text-neon-red flex-shrink-0" />
                  <span className="text-xs text-white font-medium truncate">
                    {selectedFile.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={disabled}
                  className="h-7 w-7 p-0 hover:bg-neon-red/20 rounded-lg flex-shrink-0 ml-2"
                >
                  <X className="w-4 h-4 text-neon-red" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-red/10 border border-neon-red/30">
              <AlertTriangle className="w-4 h-4 text-neon-red flex-shrink-0" />
              <span className="text-xs text-neon-red font-medium">
                人質已就位，違規時將被公開
              </span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-mac-textSecondary/60 text-center">
          （可選）不上傳照片將僅發布文字懲罰
        </p>
      </div>
    </div>
  )
}
