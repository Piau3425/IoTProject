/**
 * 通用按鈕組件 (Button)
 * 基於 Shadcn UI 規範實作，並整合了自定義的磁性吸附特效。
 * 支援多種視覺變體 (Variants) 與尺寸 (Sizes)，具備高度的擴展性。
 * 使用 class-variance-authority (cva) 管理樣式表。
 */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { MagneticButton } from "@/components/Landing/MagneticButton"

import { cn } from "@/lib/utils"

// 定義按鈕的各種外觀樣式與尺寸預設值
const buttonVariants = cva(
  "inline-flex items-center justify-center text-center rounded-xl text-sm font-medium ring-offset-background transition-all duration-400 ease-luxury focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 break-words active:scale-95 backface-hidden",
  {
    variants: {
      variant: {
        default: "glass bg-mac-accent text-white hover:bg-mac-accentHover shadow-mac hover:shadow-mac-lg",
        destructive:
          "bg-neon-red text-white hover:bg-neon-red/90 shadow-glow-red hover:shadow-glow-red",
        outline:
          "glass border-2 border-white/20 hover:border-white/40 hover:bg-white/5",
        secondary:
          "glass bg-white/10 text-white hover:bg-white/20",
        ghost: "hover:bg-white/10 hover:text-white",
        link: "text-mac-accent underline-offset-4 hover:underline",
        success: "bg-neon-green text-white hover:bg-neon-green/90 shadow-glow-green hover:shadow-glow-green",
      },
      size: {
        default: "h-auto min-h-10 px-5 py-2.5",
        sm: "h-auto min-h-9 rounded-lg px-4 py-2 text-xs",
        lg: "h-auto min-h-12 rounded-xl px-8 py-3.5 text-base",
        xl: "h-auto min-h-14 rounded-2xl px-10 py-4 text-lg font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean  // 是否採用 Radix Slot 模式（由子元素決定標籤）
  magnetic?: boolean // 是否啟用磁性吸引特效
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, magnetic = true, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    /**
     * 磁性吸附邏輯處理：
     * 預設情況下，非 link 變體且非子組件模式的按鈕會自動包裹在 MagneticButton 內，
     * 提供滑鼠懸停時微小追隨的物理感。
     */
    if (magnetic && variant !== 'link' && !asChild) {
      return (
        <MagneticButton
          as="div"
          className="inline-block"
          strength={0.35}
          distance={80}
        >
          <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
          >
            {children}
          </Comp>
        </MagneticButton>
      )
    }

    // 普通渲染路徑（不帶磁性或為 link 模式時採用）
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
