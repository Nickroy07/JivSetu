import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-leaf-50 text-leaf-700 ring-leaf-100",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

const dots: Record<Tone, string> = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  success: "bg-leaf-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  violet: "bg-violet-500",
};

export default function Badge({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}
