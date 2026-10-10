import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
