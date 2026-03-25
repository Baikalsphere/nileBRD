import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes } from "react";

type TextareaVariant = "default" | "outlined" | "subtle";

const variantClasses: Record<TextareaVariant, string> = {
  default:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-slate-300 resize-none",
  outlined:
    "w-full rounded-xl border-2 border-slate-300 bg-transparent px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none",
  subtle:
    "w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all duration-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:bg-slate-100 resize-none",
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: TextareaVariant;
};

export function Textarea({
  className,
  variant = "default",
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        variantClasses[variant],
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}