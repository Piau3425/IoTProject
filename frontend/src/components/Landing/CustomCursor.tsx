import { useEffect, useRef, useState } from 'react'

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null)
  const cursorDotRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  
  // Use refs for mutable state to avoid re-renders
  const mousePos = useRef({ x: 0, y: 0 })
  const cursorPos = useRef({ x: 0, y: 0 })
  const dotPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const cursor = cursorRef.current
    const dot = cursorDotRef.current
    if (!cursor || !dot) return

    let rafId: number

    const updateCursor = () => {
      // Smooth interpolation for the glow (laggy)
      const lerpFactor = 0.1
      cursorPos.current.x += (mousePos.current.x - cursorPos.current.x) * lerpFactor
      cursorPos.current.y += (mousePos.current.y - cursorPos.current.y) * lerpFactor

      // Faster interpolation for the dot (responsive)
      const dotLerpFactor = 0.5
      dotPos.current.x += (mousePos.current.x - dotPos.current.x) * dotLerpFactor
      dotPos.current.y += (mousePos.current.y - dotPos.current.y) * dotLerpFactor

      // Apply transforms
      cursor.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0) translate(-50%, -50%)`
      dot.style.transform = `translate3d(${dotPos.current.x}px, ${dotPos.current.y}px, 0) translate(-50%, -50%)`

      rafId = requestAnimationFrame(updateCursor)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => setIsHovering(false)

    // Add listeners to interactive elements
    const setupListeners = () => {
      const elements = document.querySelectorAll(
        'button, a, input, textarea, [role="button"], .interactive'
      )
      elements.forEach(el => {
        el.addEventListener('mouseenter', handleMouseEnter)
        el.addEventListener('mouseleave', handleMouseLeave)
      })
      return elements
    }

    let elements = setupListeners()

    // Observer for dynamic content
    const observer = new MutationObserver(() => {
      elements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
      elements = setupListeners()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('mousemove', handleMouseMove)
    rafId = requestAnimationFrame(updateCursor)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      observer.disconnect()
      elements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
    }
  }, [])

  return (
    <>
      {/* Main Dot */}
      <div
        ref={cursorDotRef}
        className="fixed top-0 left-0 pointer-events-none z-[10001] w-2 h-2 bg-white rounded-full mix-blend-difference"
      />
      
      {/* Glow / Follower */}
      <div
        ref={cursorRef}
        className={`fixed top-0 left-0 pointer-events-none z-[10000] rounded-full transition-all duration-300 ease-out mix-blend-screen
          ${isHovering ? 'w-16 h-16 bg-white/20 blur-md' : 'w-8 h-8 bg-white/10 blur-sm'}
        `}
      />
    </>
  )
}
