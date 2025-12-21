import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { MagneticButton } from "@/components/Landing/MagneticButton"

import { cn } from "@/lib/utils"

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
  asChild?: boolean
  magnetic?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, magnetic = true, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Wrap in MagneticButton unless disabled or it's a link variant
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
