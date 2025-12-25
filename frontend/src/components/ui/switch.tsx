/**
 * 自定義切換開關 (Switch)
 * 基於 Radix UI 的 Switch Primitive 封裝。
 * 負責提供流暢的開關切換體驗。
 * 特色：
 * 1. 採用 luxury easing 曲線，確保滑塊移動感絲滑。
 * 2. 具備懸停縮放與按下縮放的互動細節。
 * 3. 完美適配深色主題背景。
 */
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  // 開關主體：處理背景色切換與點擊反饋
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-400 ease-luxury focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input hover:scale-105 active:scale-95 backface-hidden",
      className
    )}
    {...props}
    ref={ref}
  >
    {/* 滑塊 (Thumb)：處理 x 軸位移動畫 */}
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-all duration-400 ease-luxury data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 backface-hidden"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
