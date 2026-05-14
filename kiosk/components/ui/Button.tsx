import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-zinc-800 text-white hover:bg-zinc-700 shadow-sm": variant === "default",
            "bg-red-500/10 text-red-500 hover:bg-red-500/20": variant === "destructive",
            "border border-zinc-700 bg-transparent hover:bg-zinc-800": variant === "outline",
            "hover:bg-zinc-800 text-zinc-300": variant === "ghost",
            "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20": variant === "glass",
            "h-12 px-6 py-2": size === "default",
            "h-10 rounded-xl px-4 text-xs": size === "sm",
            "h-16 rounded-3xl px-8 text-lg": size === "lg",
            "h-12 w-12": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
