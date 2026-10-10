import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-slate-300 bg-white px-3 text-[15px] text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 transition-colors " +
  "focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 " +
  "disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-rose-400 aria-invalid:ring-rose-500/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, "min-h-24 py-2 leading-relaxed", className)} {...props} />
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(control, "h-9 pr-8 text-sm", className)} {...props} />
));
Select.displayName = "Select";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-rose-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
