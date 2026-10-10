"use client";

import { Activity, ClipboardList, LogOut, ServerCog, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import Logo from "@/components/ui/Logo";
import Spinner from "@/components/ui/Spinner";
import { api, errorMessage, setUnauthorizedHandler } from "@/lib/api";
import { getStaffSession, setStaffSession, type StaffSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type Tab = "overview" | "users" | "audit" | "settings";
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Staff", icon: Users },
  { id: "audit", label: "Audit log", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: ServerCog },
];

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const leave = useCallback(
    (expired = false) => {
      const s = getStaffSession();
      if (s && !expired) api("/auth/logout", { method: "POST", token: s.token }).catch(() => undefined);
      setStaffSession(null);
      router.replace(`/doctor/login?next=/admin${expired ? "&expired=1" : ""}`);
    },
    [router]
  );

  useEffect(() => {
    const s = getStaffSession();
    if (!s) return leave(true);
    if (s.role !== "admin") return router.replace("/doctor");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate session from storage once
    setSession(s);
    setUnauthorizedHandler(() => leave(true));
    return () => setUnauthorizedHandler(null);
  }, [leave, router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner label="Loading administration" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo compact />
            <Badge tone="brand">Administration</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{session.displayName}</span>
            <Button variant="secondary" size="sm" onClick={() => leave()}>
              <LogOut className="size-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Administration">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
                tab === t.id ? "border-brand-600 text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <t.icon className="size-4" aria-hidden /> {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "overview" && <Overview token={session.token} />}
        {tab === "users" && <Staff token={session.token} />}
        {tab === "audit" && <AuditLog token={session.token} />}
        {tab === "settings" && <Settings token={session.token} />}
      </main>
    </div>
  );
}

/** Fetch-on-mount with loading and error state. */
function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(path, { token })
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [path, token, tick]);
  return { data, error, reload: () => setTick((n) => n + 1) };
}

function State({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) return <Alert tone="danger">{error}</Alert>;
  return loading ? <Spinner label="Loading" /> : null;
}

interface OverviewData {
  counts: Record<"patients" | "visits" | "active_staff" | "documents" | "failed_documents", number>;
  system: { database: { backend: string; status: string }; otp_provider: string; ocr_engines: Record<string, boolean>; environment: string; demo_mode: boolean };
}

function Overview({ token }: { token: string }) {
  const { data, error } = useApi<OverviewData>("/admin/overview", token);
  if (!data) return <State error={error} loading />;
  const c = data.counts;
  const stats: [string, number][] = [
    ["Patients", c.patients],
    ["Visits", c.visits],
    ["Active staff", c.active_staff],
    ["Documents", c.documents],
    ["Failed documents", c.failed_documents],
  ];
  const engines = Object.entries(data.system.ocr_engines);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={cn("tnum mt-1 text-2xl font-semibold", label === "Failed documents" && value > 0 ? "text-rose-700" : "text-slate-900")}>{value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">System health</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Database">
            <Badge tone={data.system.database.status === "ok" ? "success" : "danger"} dot>
              {data.system.database.backend} · {data.system.database.status}
            </Badge>
          </Row>
          <Row label="OTP delivery">
            <Badge tone={data.system.otp_provider === "dev" ? "warning" : "success"}>
              {data.system.otp_provider === "dev" ? "development only" : data.system.otp_provider}
            </Badge>
          </Row>
          <Row label="Text-PDF / OCR engines">
            <span className="flex flex-wrap gap-1.5">
              {engines.map(([name, on]) => (
                <Badge key={name} tone={on ? "success" : "neutral"}>
                  {name}: {on ? "available" : "not installed"}
                </Badge>
              ))}
            </span>
          </Row>
          <Row label="Environment">
            <Badge tone="neutral">{data.system.environment}</Badge> {data.system.demo_mode && <Badge tone="warning">demo mode</Badge>}
          </Row>
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="flex items-center gap-1.5">{children}</dd>
    </div>
  );
}

interface StaffRow {
  id: number;
  user_code: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
}

function Staff({ token }: { token: string }) {
  const [search, setSearch] = useState("");
  const { data, error, reload } = useApi<{ items: StaffRow[] }>(`/admin/users?search=${encodeURIComponent(search)}`, token);
  const [form, setForm] = useState({ user_code: "", full_name: "", role: "doctor", password: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api("/admin/users", { method: "POST", token, json: form });
      setForm({ user_code: "", full_name: "", role: "doctor", password: "" });
      setMessage({ tone: "success", text: "Staff account created." });
      reload();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(u: StaffRow) {
    const verb = u.is_active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${u.user_code}?${u.is_active ? " They will be signed out immediately." : ""}`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", token, json: { is_active: !u.is_active } });
      reload();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <Input placeholder="Search staff ID or name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search staff" />
        </div>
        {!data ? (
          <div className="p-5"><State error={error} loading /></div>
        ) : data.items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No staff accounts match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{u.full_name ?? u.user_code}</p>
                  <p className="truncate text-xs text-slate-500">{u.user_code} · {u.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={u.is_active ? "success" : "neutral"} dot>{u.is_active ? "Active" : "Inactive"}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Reactivate"}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="h-fit p-5">
        <h2 className="font-semibold text-slate-900">Add staff account</h2>
        <form onSubmit={create} className="mt-4 space-y-3">
          <Field label="Staff ID">{(p) => <Input {...p} required minLength={3} value={form.user_code} onChange={(e) => setForm({ ...form, user_code: e.target.value })} />}</Field>
          <Field label="Full name">{(p) => <Input {...p} required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />}</Field>
          <Field label="Role">
            {(p) => (
              <Select {...p} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="doctor">Doctor</option>
                <option value="admin">Administrator</option>
              </Select>
            )}
          </Field>
          <Field label="Temporary password" hint="At least 10 characters.">
            {(p) => <Input {...p} type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          </Field>
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <Button type="submit" loading={saving} className="w-full">Create account</Button>
        </form>
      </Card>
    </div>
  );
}

interface AuditData {
  total: number;
  items: { id: number; action: string; resource_type: string; resource_id: string; details: string | null; created_at: string | null }[];
}

function AuditLog({ token }: { token: string }) {
  const [filter, setFilter] = useState("");
  const { data, error } = useApi<AuditData>(`/admin/audit?action=${encodeURIComponent(filter)}`, token);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <Input className="max-w-xs" placeholder="Filter by action, e.g. admin. or auth." value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter audit log" />
        <p className="text-sm text-slate-500">Read-only · {data?.total ?? 0} events</p>
      </div>
      {!data ? (
        <div className="p-5"><State error={error} loading /></div>
      ) : data.items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No audit events match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Time</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Resource</th><th className="px-4 py-2">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{a.created_at ? new Date(a.created_at + "Z").toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{a.action}</td>
                  <td className="px-4 py-2 text-slate-600">{a.resource_type} #{a.resource_id}</td>
                  <td className="px-4 py-2 text-slate-500">{a.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface HospitalData { hospital_code: string; name: string; name_hi: string | null; name_mr: string | null }
interface ConfigData {
  languages: { code: string; label: string }[];
  integrations: { sms_otp: { provider: string; configured: boolean }; abdm: { configured: boolean; note: string } };
  max_upload_mb: number;
}

function Settings({ token }: { token: string }) {
  const hospital = useApi<HospitalData>("/admin/hospital", token);
  const config = useApi<ConfigData>("/admin/config", token);
  const [form, setForm] = useState<HospitalData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const loaded = hospital.data;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the edit form once the hospital loads
    if (loaded) setForm(loaded);
  }, [loaded]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await api("/admin/hospital", { method: "PATCH", token, json: { name: form.name, name_hi: form.name_hi ?? "", name_mr: form.name_mr ?? "" } });
      setMessage({ tone: "success", text: "Hospital details saved." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Hospital</h2>
        {!form ? (
          <div className="mt-4"><State error={hospital.error} loading /></div>
        ) : (
          <form onSubmit={save} className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">Facility code: <span className="font-mono">{form.hospital_code}</span> (not editable)</p>
            <Field label="Name (English)">{(p) => <Input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Name (हिन्दी)">{(p) => <Input {...p} value={form.name_hi ?? ""} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} />}</Field>
            <Field label="Name (मराठी)">{(p) => <Input {...p} value={form.name_mr ?? ""} onChange={(e) => setForm({ ...form, name_mr: e.target.value })} />}</Field>
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Configuration</h2>
        {!config.data ? (
          <div className="mt-4"><State error={config.error} loading /></div>
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Languages">{config.data.languages.map((l) => <Badge key={l.code}>{l.label}</Badge>)}</Row>
            <Row label="SMS OTP"><Badge tone={config.data.integrations.sms_otp.configured ? "success" : "warning"}>{config.data.integrations.sms_otp.configured ? config.data.integrations.sms_otp.provider : "not configured (dev OTP)"}</Badge></Row>
            <Row label="ABDM"><Badge tone="neutral">not configured</Badge></Row>
            <Row label="Max upload"><span>{config.data.max_upload_mb} MB</span></Row>
            <p className="text-xs text-slate-500">Secrets and keys are set in the server environment and are never shown here.</p>
          </dl>
        )}
      </Card>
    </div>
  );
}
