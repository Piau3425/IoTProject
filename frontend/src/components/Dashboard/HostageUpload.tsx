/**
 * 人質照片上傳組件 (HostageUpload)
 * 負責單次專注任務中的「人質」上傳邏輯。
 * 使用者可以在開始任務前上傳一張照片，若任務失敗，該照片將作為處罰素材被發布。
 * 核心功能包含拖放上傳、即時預覽、以及預覽記憶體釋放管理。
 */
import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ImageIcon, Upload, X, AlertTriangle, Shield } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

interface HostageUploadProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  disabled?: boolean
}

export function HostageUpload({ onFileSelect, selectedFile, disabled }: HostageUploadProps) {
  const { t } = useLanguage()
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 處理檔案選取的核心逻辑，整合預覽圖產出與清理
  const handleFile = useCallback((file: File | null) => {
    if (file) {
      // 安全性檢查：僅允許圖片格式
      if (!file.type.startsWith('image/')) {
        alert(t('hostageUpload.uploadImageAlert'))
        return
      }

      // 產生暫存的 Blob URL 用於即時預覽
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelect(file)
    } else {
      // 清除邏輯：務必釋放舊預覽圖的記憶體，避免 Memory Leak
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      onFileSelect(null)
    }
  }, [onFileSelect, previewUrl])

  // 處理拖疊特效 (Drag & Drop)
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

  // 重置選取狀態
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
          <span className="uppercase tracking-wide font-chinese">{t('hostageUpload.protocolTitle')}</span>
        </h3>
        <p className="text-xs text-mac-textSecondary font-chinese">
          {t('hostageUpload.description')}
        </p>
      </div>

      <div>
        {!selectedFile ? (
          /* 上傳區域：尚未選取檔案時顯示 */
          <div
            className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer interactive
              ${dragActive
                ? 'border-neon-purple bg-neon-purple/10 scale-105'
                : 'border-white/20 hover:border-neon-purple/50 hover:bg-white/5'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            role="button"
            data-magnet="true"
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
                <p className="text-sm font-medium text-white mb-1 font-chinese">
                  {t('hostageUpload.dragOrClick')}
                </p>
                <p className="text-xs text-mac-textSecondary font-chinese">
                  {t('hostageUpload.supportedFormats')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* 預覽區域：已選取檔案後呈現強烈的警告視覺 */
          <div className="relative animate-scale-in">
            <div className="relative rounded-xl overflow-hidden border-2 border-neon-red/50 shadow-glow-red">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={t('hostageUpload.hostagePreview')}
                  className="w-full h-36 object-cover"
                />
              )}
              {/* 遮罩漸層：增加質感並凸顯文字 */}
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
            {/* 警告標籤：加強「人質」概念的儀式感 */}
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-red/10 border border-neon-red/30">
              <AlertTriangle className="w-4 h-4 text-neon-red flex-shrink-0" />
              <span className="text-xs text-neon-red font-medium font-chinese">
                {t('hostageUpload.hostageReady')}
              </span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-mac-textSecondary/60 text-center font-chinese">
          {t('hostageUpload.optionalNote')}
        </p>
      </div>
    </div>
  )
}
