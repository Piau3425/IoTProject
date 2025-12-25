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
    // Copy ref value for cleanup
    const currentAudioRefs = audioRefs.current
    return () => {
      Object.values(currentAudioRefs).forEach(audio => {
        if (audio) {
          audio.pause()
          audio.src = ''
        }
      })
    }
  }, [])

  // Lazy load audio: only attempt to load on first play
  const loadAudio = useCallback((effect: SoundEffect) => {
    if (audioRefs.current[effect] || attemptedLoads.current[effect]) {
      return // Already loaded or already attempted
    }

    attemptedLoads.current[effect] = true
    const url = SOUND_URLS[effect]

    // Silent load, errors are acceptable (audio is optional)
    try {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = 0.7

      audio.addEventListener('error', () => {
        // Silent error handling - missing audio files are acceptable
        audioRefs.current[effect] = null
      })

      audio.addEventListener('canplaythrough', () => {
        audioRefs.current[effect] = audio
      }, { once: true })
    } catch {
      // Silent handling
    }
  }, [])

  const play = useCallback((effect: SoundEffect) => {
    // Attempt to load audio (if not already loaded)
    loadAudio(effect)

    const audio = audioRefs.current[effect]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Silent error handling for play failures
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
