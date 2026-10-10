import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative size-8 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <Image
          src="/images/logo/logo.png"
          alt=""
          width={64}
          height={64}
          className="absolute left-1/2 top-[-9%] size-[172%] max-w-none -translate-x-1/2 object-cover"
          priority
        />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">
          Jivsetu<span className="ml-1 font-medium text-brand-600">AI</span>
        </span>
      )}
    </span>
  );
}
