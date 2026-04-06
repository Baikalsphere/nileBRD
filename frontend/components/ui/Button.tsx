import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150 focus:outline-none focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // App variants
        primary:            "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm",
        secondary:          "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100",
        ghost:              "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
        danger:             "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm",
        success:            "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm",
        outline:            "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 active:bg-slate-100",
        "gradient-primary": "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm",
        // shadcn-compat variants
        default:      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
        destructive:  "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
        link:         "text-indigo-600 underline-offset-4 hover:underline",
      },
      size: {
        sm:      "h-7 px-3 text-xs",
        md:      "h-9 px-4 py-2 text-sm",
        lg:      "h-10 px-5 text-sm",
        default: "h-9 px-4 py-2 text-sm",
        icon:    "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="mr-2 h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
