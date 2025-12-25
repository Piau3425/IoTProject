/**
 * 系統狀態過渡特效組件 (StateTransitionOverlay)
 * 負責在系統狀態發生切換時（如：從 IDLE 到 ACTIVE），
 * 提供一個全螢幕的視覺反饋效果，增強介面的動態感與沉浸感。
 * 底層使用 GSAP 執行高性能的縮放與模糊動畫。
 */
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

interface StateTransitionOverlayProps {
  state: string // 系統當前狀態，例如：'IDLE', 'PREPARING', 'ACTIVE', 'PENALTY'
}

export function StateTransitionOverlay({ state }: StateTransitionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousState = useRef(state)

  useEffect(() => {
    // 只有在狀態真正改變時才執行特效，避免重複渲染觸發
    if (state === previousState.current) return

    // 初始載入如果是虛無狀態切換到 IDLE，則跳過特效呈現，避免進入畫面時突現閃爍
    if (previousState.current === undefined && state === 'IDLE') {
      previousState.current = state
      return
    }

    // 使用 GSAP context 確保在 React strict mode 或組件卸載時能正確釋放資源
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // 初始化狀態：完全縮小且不透明度為 1
      gsap.set(overlayRef.current, {
        opacity: 1,
        scale: 0,
        // backdropFilter: "blur(0px)",
      })

      // 動畫流程：從中心圓形擴展，伴隨強烈的毛玻璃模糊效果
      tl.to(overlayRef.current, {
        scale: 2, // 擴展至超過螢幕範圍
        // backdropFilter: "blur(20px)",
        duration: 0.6,
        ease: "power2.inOut",
      })
        .to(overlayRef.current, {
          opacity: 0, // 完成擴展後淡出消失
          duration: 0.4,
          ease: "power2.out",
        })
        .set(overlayRef.current, {
          scale: 0, // 重設狀態，為下次觸發做準備
          // backdropFilter: "blur(0px)",
        })

    }, overlayRef)

    previousState.current = state
    return () => ctx.revert()
  }, [state])

  return (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-50 pointer-events-none flex items-center justify-center",
        "bg-white/5" // 輕微的閃白效果，增加儀式感
      )}
      style={{
        opacity: 0,
        transform: "scale(0)",
        borderRadius: "50%", // 圓形向外擴散的視覺風格
      }}
    />
  )
}
