import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'

export function AdvancedCursor() {
    // Mouse position states
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    // Smooth springs for trailing cursor
    const springConfig = { damping: 20, stiffness: 150, mass: 0.8 }
    // const cursorX = useSpring(mouseX, springConfig)
    // const cursorY = useSpring(mouseY, springConfig)

    // Interactive states
    const [isHovering, setIsHovering] = useState(false)
    const [isClicking, setIsClicking] = useState(false)
    const [isText, setIsText] = useState(false)
    const [magnetPos, setMagnetPos] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
    const [skewValue, setSkewValue] = useState(0)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // If we are magnetically locked, don't update *trailing* cursor position directly from mouse
            // usage of raw mouseX/Y remains for the leading dot
            mouseX.set(e.clientX)
            mouseY.set(e.clientY)
        }

        const handleMouseDown = () => setIsClicking(true)
        const handleMouseUp = () => setIsClicking(false)

        // Element detection logic
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            // Check if clickable
            const isClickable = target.closest('a, button, [role="button"], input, .interactive')
            const isTextInput = target.closest('input[type="text"], textarea, [contenteditable="true"]')

            // Check for custom cursor skew
            const skewTarget = target.closest('[data-cursor-skew]') as HTMLElement
            if (skewTarget) {
                const skew = skewTarget.getAttribute('data-cursor-skew')
                setSkewValue(parseInt(skew || '0'))
            } else {
                setSkewValue(0)
            }

            if (isTextInput) {
                setIsText(true)
                setIsHovering(false)
                setMagnetPos(null)
            } else if (isClickable) {
                setIsHovering(true)
                setIsText(false)

                // Calculate magnetic pull if it's a small enough element (like a button)
                // We only magnetize if the element explicitly wants it or is a standard button
                const rect = isClickable.getBoundingClientRect()
                // Only magnetize to elements smaller than 600x200 to avoid getting stuck on large cards
                if (rect.width < 600 && rect.height < 200) {
                    setMagnetPos({
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        width: rect.width,
                        height: rect.height
                    })
                } else {
                    // For large objects, we still want the hover state (expanded ring)
                    // but NOT the magnetic lock. 
                    // Previously we setMagnetPos(null) which is correct, 
                    // but logic flow naturally keeps isHovering=true here.
                    setMagnetPos(null)
                }
            } else {
                setIsHovering(false)
                setIsText(false)
                setMagnetPos(null)
            }
        }

        // Add global listeners
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('mouseover', handleMouseOver)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('mouseover', handleMouseOver)
        }
    }, [mouseX, mouseY])

    // Alternative approach for Magnetism:
    // We use a separate MotionValue for "TargetX/Y" that usually tracks MouseX/Y 
    // but snaps to MagnetX/Y when active. The Spring follows *that* target.
    const targetX = useMotionValue(0)
    const targetY = useMotionValue(0)

    const smoothX = useSpring(targetX, springConfig)
    const smoothY = useSpring(targetY, springConfig)

    useEffect(() => {
        // Update target based on mode
        const updateTarget = () => {
            if (magnetPos) {
                targetX.set(magnetPos.x)
                targetY.set(magnetPos.y)
            } else {
                targetX.set(mouseX.get())
                targetY.set(mouseY.get())
            }
            requestAnimationFrame(updateTarget)
        }
        const frame = requestAnimationFrame(updateTarget)
        return () => cancelAnimationFrame(frame)
    }, [magnetPos, mouseX, mouseY, targetX, targetY])


    return (
        <>
            {/* Leading Dot - Always follows mouse exactly */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9999]"
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%'
                }}
            >
                <div className={cn(
                    "rounded-full bg-neon-blue transition-all duration-200",
                    isClicking ? "w-1 h-1" : "w-1.5 h-1.5",
                    isHovering || isText ? "opacity-0" : "opacity-100" // Hide dot when hovering for cleaner look
                )} />
            </motion.div>

            {/* Trailing / Interaction Cursor */}
            <motion.div
                className={cn(
                    "fixed top-0 left-0 pointer-events-none z-[9998] border border-white/40 flex items-center justify-center transition-colors duration-200",
                    isHovering ? "border-neon-blue bg-transparent backdrop-blur-[0px]" : "rounded-full",
                    isText ? "border-transparent bg-white/20 w-[2px] h-6 rounded-none relative" : ""
                )}
                style={{
                    x: smoothX,
                    y: smoothY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                animate={{
                    width: magnetPos ? magnetPos.width + 12 : isHovering ? 48 : 24,
                    height: magnetPos ? magnetPos.height + 12 : isHovering ? 48 : 24,
                    borderRadius: magnetPos ? 12 : isHovering ? 24 : 999, // Square-ish when magnetized
                    scale: isClicking ? 0.9 : 1,
                    skewX: skewValue, // Apply Skew
                }}
                transition={{
                    default: {
                        type: "spring",
                        visualDuration: 0.3,
                        bounce: 0.2
                    },
                    borderRadius: {
                        type: "tween",
                        // Dynamic duration: If returning to circle (no magnet), take longer if we were just on a large object
                        // But if snapping TO a magnet, be quick.
                        duration: magnetPos ? 0.2 : (isHovering ? 0.15 : 0.4),
                        ease: "easeOut"
                    },
                    width: { duration: magnetPos ? 0.2 : 0.3 },
                    height: { duration: magnetPos ? 0.2 : 0.3 }
                }}
            >
                {/* Additional decoration for specific states */}
                {/* Removed ping animation to eliminate glow effect */}
            </motion.div>
        </>
    )
}
