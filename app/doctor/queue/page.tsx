"use client";

import { AlertOctagon, ChevronLeft, ChevronRight, FileText, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { VISIT_STATUS, formatDate, humanize, timeAgo } from "@/lib/status";
import type { QueueResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const SCOPES = [
  { id: "open", label: "Open" },
  { id: "today", label: "Today" },
  { id: "all", label: "All" },
] as const;

const SORTS = [
  { id: "updated_desc", label: "Recently updated" },
  { id: "updated_asc", label: "Oldest update first" },
  { id: "date_desc", label: "Visit date" },
  { id: "name_asc", label: "Name A–Z" },
];

export default function QueuePage() {
  return (
    <DoctorShell>
      <Suspense>
        <QueueContent />
      </Suspense>
    </DoctorShell>
  );
}

function QueueContent() {
  const { token } = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const scope = params.get("scope") ?? (params.get("status") ? "all" : "open");
  const status = params.get("status") ?? "";
  const sort = params.get("sort") ?? "updated_desc";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const search = params.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (!("page" in patch)) next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  // Debounced search -> URL
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setParams({ q: searchInput.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [searchInput, search, setParams]);

  const query = useMemo(() => {
    const q = new URLSearchParams({ scope, sort, page: String(page), page_size: "20" });
    if (status) q.set("status", status);
    if (search) q.set("search", search);
    return q.toString();
  }, [scope, status, sort, page, search]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setData(await api<QueueResponse>(`/doctor/queue?${query}`, { token, signal }));
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [query, token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const filtered = !!(search || status || scope !== "open");

  return (
    <>
      <PageHeader title="Patient queue" description={data ? `${data.total} case${data.total === 1 ? "" : "s"} match the current filters` : "Loading cases…"} />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Scope">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={scope === s.id}
                onClick={() => setParams({ scope: s.id })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  scope === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, mobile, complaint or ID"
              className="h-9 pl-9 text-sm"
              aria-label="Search patients"
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => setParams({ status: e.target.value || null })} aria-label="Filter by status" className="lg:w-44">
              <option value="">All statuses</option>
              {Object.entries(VISIT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setParams({ sort: e.target.value })} aria-label="Sort" className="lg:w-48">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <Alert tone="danger" title="Couldn’t load the queue" className="mb-4" action={<Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Patient</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Complaint</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Review</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Signals</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-slate-100 transition-opacity", loading && data && "opacity-60")}>
              {!data && loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3" colSpan={6}><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))
                : data?.items.map((c) => (
                    <tr
                      key={c.visit_id}
                      className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                      onClick={() => router.push(`/doctor/cases/${c.visit_id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.full_name} />
                          <div className="min-w-0">
                            <Link href={`/doctor/cases/${c.visit_id}`} className="font-medium text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {c.full_name}
                            </Link>
                            <p className="tnum text-xs text-slate-500">
                              #{c.patient_id} · ••{c.mobile_last4} · {formatDate(c.visit_date)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-48 truncate px-3 py-3 text-slate-700">{c.chief_complaint ? humanize(c.chief_complaint) : <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-3"><StatusBadge kind="visit" status={c.status} /></td>
                      <td className="px-3 py-3">{c.physician_status ? <StatusBadge kind="review" status={c.physician_status} /> : <span className="text-xs text-slate-400">No history yet</span>}</td>
                      <td className="px-3 py-3"><Signals c={c} /></td>
                      <td className="tnum whitespace-nowrap px-5 py-3 text-right text-xs text-slate-500">{timeAgo(c.updated_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {!data && loading
            ? Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-4"><Skeleton className="h-12 w-full" /></li>)
            : data?.items.map((c) => (
                <li key={c.visit_id}>
                  <Link href={`/doctor/cases/${c.visit_id}`} className="block p-4 hover:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <Avatar name={c.full_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-slate-900">{c.full_name}</p>
                          <span className="shrink-0 text-xs text-slate-500">{timeAgo(c.updated_at)}</span>
                        </div>
                        <p className="truncate text-[13px] text-slate-500">{c.chief_complaint ? humanize(c.chief_complaint) : "No complaint yet"} · #{c.visit_id}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge kind="visit" status={c.status} />
                          <Signals c={c} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
        </ul>

        {data && data.items.length === 0 && (
          <EmptyState
            icon={<Users className="size-5" />}
            title={filtered ? "No cases match these filters" : "The queue is empty"}
            description={filtered ? "Try a different search or clear the filters." : "New check-ins from the patient kiosk will appear here."}
            action={filtered ? <Button variant="outline" size="sm" onClick={() => { setSearchInput(""); router.replace(pathname); }}>Clear filters</Button> : undefined}
          />
        )}

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm">
            <span className="tnum text-slate-500">
              Page {data.page} of {data.total_pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setParams({ page: String(page + 1) })}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function Signals({ c }: { c: QueueResponse["items"][number] }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      {c.red_flags > 0 && (
        <span className="inline-flex items-center gap-1 font-medium text-rose-700" title="Screening flags">
          <AlertOctagon className="size-3.5" /> {c.red_flags}
        </span>
      )}
      <span className={cn("inline-flex items-center gap-1", c.documents_failed ? "text-rose-700" : "text-slate-500")} title="Documents">
        <FileText className="size-3.5" /> {c.documents}
        {c.documents_failed > 0 && <span>({c.documents_failed} failed)</span>}
        {c.documents_processing > 0 && <span>({c.documents_processing} reading)</span>}
      </span>
    </div>
  );
}
