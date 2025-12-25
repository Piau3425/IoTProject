/**
 * 自定義輸入框 (Input)
 * 針對深色主題優化的文字輸入組件。
 * 特色：
 * 1. 採用 luxury easing 曲線，使細微的邊框與背景色切換更加流暢。
 * 2. 針對偽類 (focus-visible, hover) 提供明確的視覺反饋。
 * 3. 具備 transform-gpu 優化的高品質渲染效果。
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg bg-[#1a1a1a] border border-white/20 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 ease-luxury hover:border-white/30 transform-gpu",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
