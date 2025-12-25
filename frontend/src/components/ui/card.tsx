/**
 * 進階卡片組件 (Card)
 * 提供具備物理感 (Physics-based) 的視覺容器。
 * 核心特色：
 * 1. 彈性反饋：透過 useSpring 鉤子實現懸停時的縮放與旋轉效果。
 * 2. 3D 視角：應用 perspective 屬性營造空間深度感。
 * 3. 高級陰影：動態過渡的環境遮蔽陰影 (Ambient Occlusion)。
 */
import * as React from "react"
import { cn } from "@/lib/utils"
import { useSpring } from "@/hooks/usePhysics"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const divRef = React.useRef<HTMLDivElement>(null)

  // 暴露內部 Ref 給 forwardRef 使用
  React.useImperativeHandle(ref, () => divRef.current!)

  /**
   * 套用物理彈簧特效：
   * 當滑鼠互動時，卡片會產生細微的縮放 (Scale) 與傾斜變換。
   */
  useSpring(divRef, { scale: 0.98, active: true });

  return (
    <div
      ref={divRef}
      className={cn(
        "mac-card group relative overflow-hidden transition-all duration-500 ease-out",
        "hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]", // 懸停時產生更深邃的投影
        "transform-gpu perspective-1000",
        "border border-white/5", // 極其細微的邊框，增加精緻感
        className
      )}
      style={{
        // 使用 CSS 變數配合物理計算實作 3D 旋轉
        transform: "perspective(1000px) rotateX(var(--rotate-x, 0deg)) rotateY(var(--rotate-y, 0deg)) translateZ(0)",
        transition: "transform 0.1s ease-out, box-shadow 0.5s ease",
      } as React.CSSProperties}
      {...props}
    >
      {/* 內容包裝層：確保內容始終位於特效層之上 */}
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
