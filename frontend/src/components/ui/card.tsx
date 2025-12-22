import * as React from "react"
import { cn } from "@/lib/utils"
import { useSpring } from "@/hooks/usePhysics"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const divRef = React.useRef<HTMLDivElement>(null)
  
  React.useImperativeHandle(ref, () => divRef.current!)

  // Apply physics spring effect
  useSpring(divRef, { scale: 0.98, active: true });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    divRef.current.style.setProperty("--mouse-x", `${x}px`)
    divRef.current.style.setProperty("--mouse-y", `${y}px`)

    // Enhanced Tilt logic with depth
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -5 // Increased tilt range
    const rotateY = ((x - centerX) / centerX) * 5

    divRef.current.style.setProperty("--rotate-x", `${rotateX}deg`)
    divRef.current.style.setProperty("--rotate-y", `${rotateY}deg`)
  }

  const handleMouseLeave = () => {
    if (!divRef.current) return
    divRef.current.style.setProperty("--rotate-x", "0deg")
    divRef.current.style.setProperty("--rotate-y", "0deg")
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "mac-card group relative overflow-hidden transition-all duration-500 ease-out",
        "hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]", // Deep shadow on hover
        "transform-gpu perspective-1000",
        "border border-white/5", // Subtle border
        className
      )}
      style={{
        transform: "perspective(1000px) rotateX(var(--rotate-x, 0deg)) rotateY(var(--rotate-y, 0deg)) translateZ(0)",
        transition: "transform 0.1s ease-out, box-shadow 0.5s ease",
      } as React.CSSProperties}
      {...props}
    >
      {/* Border Follow Effect */}
      <div 
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.15), transparent 40%)`,
          zIndex: 1,
        }}
      />
      
      {/* Inner Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.03), transparent 40%)`,
          zIndex: 2,
        }}
      />

      {/* Content Wrapper to ensure it sits above effects */}
      <div className="relative z-10">
        {props.children}
      </div>
    </div>
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
