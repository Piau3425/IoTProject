/**
 * 自定義滑桿 (Slider)
 * 基於 Radix UI 的 Slider Primitive 封裝。
 * 特色：
 * 1. 具備漸層色軌軌道 (mac-accent 到 neon-blue)。
 * 2. 滑塊 (Thumb) 具備高品質的發光陰影與縮放反饋。
 * 3. 優化觸控與滑鼠互動體驗，支援 grab/grabbing 游標切換。
 */
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group",
      className
    )}
    {...props}
  >
    {/* 滑桿軌道 */}
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10 transition-all duration-300">
      {/* 已選取範圍的漸層色填充 */}
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-mac-accent to-neon-blue transition-all duration-400 ease-luxury" />
    </SliderPrimitive.Track>
    {/* 可拖動的滑塊 */}
    <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border-2 border-white bg-mac-accent shadow-glow-blue transition-all duration-300 ease-luxury focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mac-accent focus-visible:ring-offset-2 focus-visible:ring-offset-mac-bg disabled:pointer-events-none disabled:opacity-50 hover:scale-125 hover:shadow-[0_0_30px_rgba(0,122,255,0.8)] cursor-grab active:cursor-grabbing active:scale-110 backface-hidden z-10" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
