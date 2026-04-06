import { cn } from "@/lib/utils"
import * as React from "react"

type InputVariant = "default" | "outlined" | "subtle"

const variantClasses: Record<InputVariant, string> = {
  default:
    "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",
  outlined:
    "w-full rounded-lg border-2 border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
  subtle:
    "w-full rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:bg-slate-100",
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          variantClasses[variant],
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
