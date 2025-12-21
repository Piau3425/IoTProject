import { useRef, ReactNode, useEffect } from 'react'
import { gsap } from 'gsap'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  strength?: number
  distance?: number
  as?: 'button' | 'div' | 'a'
  href?: string
}

export const MagneticButton = ({ 
  children, 
  className = '', 
  onClick,
  strength = 0.5,
  distance = 100,
  as: Component = 'button',
  href,
}: MagneticButtonProps) => {
  const buttonRef = useRef<HTMLElement>(null)
  const magneticRef = useRef<HTMLDivElement>(null)
  const rafId = useRef<number>()

  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const button = buttonRef.current
    const magnetic = magneticRef.current
    if (!button || !magnetic) return

    const rect = button.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const distanceX = e.clientX - centerX
    const distanceY = e.clientY - centerY
    const distanceFromCenter = Math.sqrt(distanceX ** 2 + distanceY ** 2)

    // Only apply magnetic effect if within distance threshold
    if (distanceFromCenter < distance) {
      // Exponential easing for more natural feel
      const intensity = Math.pow((distance - distanceFromCenter) / distance, 1.5)
      
      const moveX = distanceX * strength * intensity
      const moveY = distanceY * strength * intensity

      // Use GSAP for smooth, hardware-accelerated animation
      // Round to prevent subpixel rendering blur
      gsap.to(magnetic, {
        x: Math.round(moveX),
        y: Math.round(moveY),
        duration: 0.5,
        ease: 'power3.out',
        force3D: true, // Hardware acceleration
      })
    }
  }

  const handleMouseLeave = () => {
    const magnetic = magneticRef.current
    if (!magnetic) return

    // Snap back with elastic spring physics
    gsap.to(magnetic, {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: 'elastic.out(1, 0.4)', // Heavy, premium feel
      force3D: true,
    })
  }

  const props = {
    ref: buttonRef as any,
    className,
    onClick,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    'data-magnetic': 'true',
    ...(Component === 'a' && href ? { href } : {}),
  }

  return (
    <Component {...props}>
      <div 
        ref={magneticRef} 
        style={{ 
          display: 'inline-block',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </Component>
  )
}
