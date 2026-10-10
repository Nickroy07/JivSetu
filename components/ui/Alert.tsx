import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const styles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", icon: <Info className="size-4 text-sky-600" /> },
  success: { box: "border-leaf-100 bg-leaf-50 text-leaf-700", icon: <CheckCircle2 className="size-4 text-leaf-600" /> },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: <AlertTriangle className="size-4 text-amber-600" /> },
  danger: { box: "border-rose-200 bg-rose-50 text-rose-900", icon: <XCircle className="size-4 text-rose-600" /> },
};

export default function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = styles[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm animate-fade-in", s.box, className)}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
