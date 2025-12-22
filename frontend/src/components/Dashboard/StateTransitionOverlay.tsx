import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

interface StateTransitionOverlayProps {
  state: string // e.g., 'IDLE', 'PREPARING', 'ACTIVE', 'PENALTY'
}

export function StateTransitionOverlay({ state }: StateTransitionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousState = useRef(state)

  useEffect(() => {
    if (state === previousState.current) return

    // Don't animate on initial load if it's just IDLE
    if (previousState.current === undefined && state === 'IDLE') {
      previousState.current = state
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // Reset
      gsap.set(overlayRef.current, {
        opacity: 1,
        scale: 0,
        backdropFilter: "blur(0px)",
      })

      // Animation: Expand from center with blur
      tl.to(overlayRef.current, {
        scale: 2, // Expand beyond screen
        backdropFilter: "blur(20px)",
        duration: 0.6,
        ease: "power2.inOut",
      })
      .to(overlayRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      })
      .set(overlayRef.current, {
        scale: 0, // Reset
        backdropFilter: "blur(0px)",
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
        "bg-white/5" // Subtle flash
      )}
      style={{
        opacity: 0,
        transform: "scale(0)",
        borderRadius: "50%", // Circular expansion
      }}
    />
  )
}
