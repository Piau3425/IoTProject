/**
 * 自定義核取方塊 (Checkbox)
 * 基於 Radix UI 的 Checkbox Primitive 封裝。
 * 特色：
 * 1. 具備高質感的彈性動畫 (Luxury Easing)。
 * 2. 懸停與點擊時具備動態縮放回饋。
 * 3. 勾選狀態切換時觸發內部的縮放動畫 (animate-scale-in)。
 */
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground transition-all duration-300 ease-luxury hover:scale-110 active:scale-95 backface-hidden",
      className
    )}
    {...props}
  >
    {/* 勾選指示器：僅在選中狀態下渲染 */}
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current animate-scale-in")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
