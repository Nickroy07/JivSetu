import Link from "next/link";
import { ButtonHTMLAttributes, ComponentProps, forwardRef } from "react";
import { cn } from "@/lib/utils";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors " +
  "disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
  secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100",
  outline: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-700 text-white shadow-sm hover:bg-rose-800",
  success: "bg-leaf-700 text-white shadow-sm hover:bg-leaf-600",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-[13px]",
  md: "h-9 rounded-md px-3.5 text-sm",
  lg: "h-11 rounded-lg px-5 text-[15px]",
  xl: "h-14 rounded-lg px-6 text-lg",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export default Button;
