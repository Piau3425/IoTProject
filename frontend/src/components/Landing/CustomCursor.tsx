import { useEffect, useRef, useState } from 'react'

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null)
  const cursorInnerRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  const mousePos = useRef({ x: 0, y: 0 })
  const cursorPos = useRef({ x: 0, y: 0 })
  const cursorInnerPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const cursor = cursorRef.current
    const cursorInner = cursorInnerRef.current
    if (!cursor || !cursorInner) return

    // Hide default cursor
    document.body.style.cursor = 'none'
    
    // Use RAF for butter-smooth 60fps animations
    let rafId: number

    const updateCursor = () => {
      // Smooth interpolation for outer cursor (heavy lag)
      cursorPos.current.x += (mousePos.current.x - cursorPos.current.x) * 0.15
      cursorPos.current.y += (mousePos.current.y - cursorPos.current.y) * 0.15

      // Faster interpolation for inner cursor (light lag)
      cursorInnerPos.current.x += (mousePos.current.x - cursorInnerPos.current.x) * 0.25
      cursorInnerPos.current.y += (mousePos.current.y - cursorInnerPos.current.y) * 0.25

      // Apply transforms directly for best performance
      cursor.style.transform = `translate(${cursorPos.current.x}px, ${cursorPos.current.y}px) translate(-50%, -50%)`
      cursorInner.style.transform = `translate(${cursorInnerPos.current.x}px, ${cursorInnerPos.current.y}px) translate(-50%, -50%)`

      rafId = requestAnimationFrame(updateCursor)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => setIsHovering(false)

    // MutationObserver to watch for dynamically added elements
    const setupInteractiveListeners = () => {
      const interactiveElements = document.querySelectorAll(
        'button, a, [data-magnetic], input, textarea, [role="button"], select'
      )

      interactiveElements.forEach((el) => {
        el.addEventListener('mouseenter', handleMouseEnter)
        el.addEventListener('mouseleave', handleMouseLeave)
      })

      return interactiveElements
    }

    let currentElements = setupInteractiveListeners()

    // Watch for DOM changes
    const observer = new MutationObserver(() => {
      // Remove old listeners
      currentElements.forEach((el) => {
        el.removeEventListener('mouseenter', handleMouseEnter)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
      // Setup new ones
      currentElements = setupInteractiveListeners()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    window.addEventListener('mousemove', handleMouseMove)
    rafId = requestAnimationFrame(updateCursor)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      observer.disconnect()
      currentElements.forEach((el) => {
        el.removeEventListener('mouseenter', handleMouseEnter)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
      document.body.style.cursor = ''
    }
  }, [])

  return (
    <>
      {/* Outer cursor ring */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[10000] mix-blend-difference"
        style={{
          width: isHovering ? '60px' : '40px',
          height: isHovering ? '60px' : '40px',
          transition: 'width 0.3s ease, height 0.3s ease',
        }}
      >
        <div
          className="w-full h-full rounded-full border-2 border-white"
          style={{
            opacity: isHovering ? 0.6 : 0.5,
            transition: 'opacity 0.3s ease',
          }}
        />
      </div>

      {/* Inner cursor dot */}
      <div
        ref={cursorInnerRef}
        className="fixed top-0 left-0 pointer-events-none z-[10000] mix-blend-difference"
        style={{
          width: isHovering ? '12px' : '8px',
          height: isHovering ? '12px' : '8px',
          transition: 'width 0.3s ease, height 0.3s ease',
        }}
      >
        <div
          className="w-full h-full rounded-full bg-white"
          style={{
            opacity: isHovering ? 1 : 0.8,
            transition: 'opacity 0.3s ease',
          }}
        />
      </div>
    </>
  )
}
