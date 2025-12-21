import { useCallback, useRef, useEffect } from 'react'

export type SoundEffect = 'start' | 'warning' | 'penalty' | 'complete'

const SOUND_URLS: Record<SoundEffect, string> = {
  start: '/sounds/start.mp3',
  warning: '/sounds/warning.mp3', 
  penalty: '/sounds/penalty.mp3',
  complete: '/sounds/complete.mp3',
}

export function useAudio() {
  const audioRefs = useRef<Record<SoundEffect, HTMLAudioElement | null>>({
    start: null,
    warning: null,
    penalty: null,
    complete: null,
  })
  
  const attemptedLoads = useRef<Record<SoundEffect, boolean>>({
    start: false,
    warning: false,
    penalty: false,
    complete: false,
  })

  useEffect(() => {
    // 清理函數
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause()
          audio.src = ''
        }
      })
    }
  }, [])
  
  // 懶載入音效：只在首次播放時才嘗試載入
  const loadAudio = useCallback((effect: SoundEffect) => {
    if (audioRefs.current[effect] || attemptedLoads.current[effect]) {
      return // 已載入或已嘗試過
    }
    
    attemptedLoads.current[effect] = true
    const url = SOUND_URLS[effect]
    
    // 靜默載入，發生錯誤也不顯示（音效是可選功能）
    try {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = 0.7
      
      audio.addEventListener('error', () => {
        // 靜默處理錯誤 - 音效檔案不存在是可接受的
        audioRefs.current[effect] = null
      })
      
      audio.addEventListener('canplaythrough', () => {
        audioRefs.current[effect] = audio
      }, { once: true })
    } catch {
      // 靜默處理
    }
  }, [])

  const play = useCallback((effect: SoundEffect) => {
    // 嘗試載入音效（如果尚未載入）
    loadAudio(effect)
    
    const audio = audioRefs.current[effect]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // 靜默處理播放錯誤
      })
    }
  }, [loadAudio])

  const stop = useCallback((effect: SoundEffect) => {
    const audio = audioRefs.current[effect]
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  const stopAll = useCallback(() => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })
  }, [])

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = clampedVolume
      }
    })
  }, [])

  return {
    play,
    stop,
    stopAll,
    setVolume,
  }
}
