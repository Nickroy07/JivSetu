"use client";

import { Activity, LayoutDashboard, ListTodo, LogOut, Menu, Network, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import Logo from "@/components/ui/Logo";
import Spinner from "@/components/ui/Spinner";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { StaffSession, getStaffSession, setStaffSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const StaffContext = createContext<StaffSession | null>(null);

export function useStaff(): StaffSession {
  const s = useContext(StaffContext);
  if (!s) throw new Error("useStaff must be used inside DoctorShell");
  return s;
}

const NAV = [
  { href: "/doctor", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/doctor/queue", label: "Patient queue", icon: ListTodo },
  { href: "/doctor/monitoring", label: "Health Trends", icon: Activity },
  { href: "/doctor/ayurveda", label: "AYUSH Assessment", icon: Sparkles },
  { href: "/doctor/integrations", label: "ABDM & FHIR", icon: Network },
];

interface Health {
  demo_mode?: boolean;
  database?: { status: string };
}

export default function DoctorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  const signOut = useCallback(
    (expired = false) => {
      const current = getStaffSession();
      // Revoke the token server-side too; a failed call must not block sign-out.
      if (current && !expired) api("/auth/logout", { method: "POST", token: current.token }).catch(() => undefined);
      setStaffSession(null);
      router.replace(`/doctor/login?next=${encodeURIComponent(pathname)}${expired ? "&expired=1" : ""}`);
    },
    [router, pathname]
  );

  useEffect(() => {
    const s = getStaffSession();
    if (!s) {
      signOut();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate session from storage once
    setSession(s);
    setChecked(true);
    setUnauthorizedHandler(() => signOut(true));
    // Confirms the token is still valid server-side (not revoked, account still active).
    api("/auth/me", { token: s.token }).catch(() => undefined);
    api<Health>("/health").then(setHealth).catch(() => setHealth(null));
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close mobile nav on navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  if (!checked || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Spinner label="Loading workspace" />
      </div>
    );
  }

  const nav = (
    <nav className="space-y-0.5" aria-label="Workspace">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const user = (
    <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
        {session.displayName.replace(/^\[DEMO\]\s*/, "").replace(/^Dr\.?\s*/i, "").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{session.displayName}</p>
        <p className="truncate text-xs capitalize text-slate-500">{session.role} · {session.userId}</p>
      </div>
      <button
        onClick={() => signOut()}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <StaffContext.Provider value={session}>
      <div className="min-h-screen bg-slate-50">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-4 lg:flex">
          <Link href="/doctor" className="px-2.5 pb-6">
            <Logo />
          </Link>
          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Clinical workspace</p>
          {nav}
          <div className="mt-auto px-1">{user}</div>
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <Link href="/doctor">
            <Logo />
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        {menuOpen && (
          <div className="sticky top-14 z-20 space-y-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm animate-fade-in lg:hidden">
            {nav}
            {user}
          </div>
        )}

        <div className="lg:pl-60">
          {health?.demo_mode && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[13px] text-amber-900 sm:px-8">
              Demonstration mode — records prefixed with <strong className="font-semibold">[DEMO]</strong> are synthetic.
            </div>
          )}
          {health && health.database?.status !== "ok" && (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-[13px] text-rose-900">
              The database is not reachable. Data shown may be incomplete.
            </div>
          )}
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
