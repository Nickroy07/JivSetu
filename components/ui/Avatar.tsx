export default function Avatar({ name }: { name: string }) {
  const clean = name.replace(/^\[DEMO\]\s*/, "");
  const initials = clean
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
