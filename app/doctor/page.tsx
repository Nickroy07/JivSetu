"use client";

import { Activity, AlertOctagon, ArrowRight, ClipboardList, FileWarning, Inbox, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Avatar from "@/components/ui/Avatar";
import Button, { LinkButton } from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { DOC_TYPES, humanize, timeAgo } from "@/lib/status";
import type { Overview } from "@/lib/types";

export default function DoctorOverviewPage() {
  return (
    <DoctorShell>
      <OverviewContent />
    </DoctorShell>
  );
}

function OverviewContent() {
  const { token, displayName } = useStaff();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<Overview>("/doctor/overview", { token }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load();
  }, [load]);

  const nextCase = data?.recent_cases.find((c) => c.status === "ready_for_review" && c.physician_status === "pending");

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${displayName.replace(/^\[DEMO\]\s*/, "")}`}
        description="Today’s queue and cases that need your attention."
        actions={
          <>
            <Button variant="outline" onClick={load} loading={loading && !!data} aria-label="Refresh">
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <LinkButton href={nextCase ? `/doctor/cases/${nextCase.visit_id}` : "/doctor/queue?status=ready_for_review"}>
              Review next case <ArrowRight className="size-4" />
            </LinkButton>
          </>
        }
      />

      {error && (
        <Alert tone="danger" title="Couldn’t load the overview" className="mb-6" action={<Button size="sm" variant="outline" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In queue" value={data?.counts.in_queue} icon={<Users className="size-4" />} href="/doctor/queue?scope=open" />
        <Stat label="Awaiting review" value={data?.counts.awaiting_review} icon={<ClipboardList className="size-4" />} href="/doctor/queue?status=ready_for_review" emphasis />
        <Stat label="Check-ins today" value={data?.counts.today} icon={<Inbox className="size-4" />} href="/doctor/queue?scope=today" />
        <Stat label="Document failures" value={data?.counts.failed_documents} icon={<FileWarning className="size-4" />} tone={data && data.counts.failed_documents > 0 ? "danger" : undefined} href="#failures" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Recently updated cases"
            description="Latest activity across the queue"
            actions={<LinkButton href="/doctor/queue" variant="ghost" size="sm">View queue <ArrowRight className="size-3.5" /></LinkButton>}
          />
          {!data && loading ? (
            <ListSkeleton />
          ) : data && data.recent_cases.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title="No patients yet" description="Cases appear here as soon as a patient checks in at the kiosk." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.recent_cases.map((c) => (
                <li key={c.visit_id}>
                  <Link href={`/doctor/cases/${c.visit_id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50">
                    <Avatar name={c.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{c.full_name}</p>
                      <p className="truncate text-[13px] text-slate-500">
                        {c.chief_complaint ? humanize(c.chief_complaint) : "No complaint recorded yet"} · Visit #{c.visit_id}
                      </p>
                    </div>
                    {c.red_flags > 0 && (
                      <span className="hidden items-center gap-1 text-xs font-medium text-rose-700 sm:flex">
                        <AlertOctagon className="size-3.5" /> {c.red_flags}
                      </span>
                    )}
                    <StatusBadge kind="visit" status={c.status} />
                    <span className="tnum hidden w-20 text-right text-xs text-slate-500 md:block">{timeAgo(c.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card id="failures" className="scroll-mt-6">
            <CardHeader title="Processing failures" description="Documents that could not be read" icon={<FileWarning className="size-4" />} />
            {!data && loading ? (
              <ListSkeleton rows={2} />
            ) : data && data.processing_failures.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No failed documents. All uploads were processed.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data?.processing_failures.map((f) => (
                  <li key={f.document_id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{f.full_name}</p>
                      <span className="text-xs text-slate-500">{timeAgo(f.updated_at)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-slate-600">{DOC_TYPES[f.document_type] ?? f.document_type} — {f.error ?? "Unknown error"}</p>
                    {f.visit_id && (
                      <Link href={`/doctor/cases/${f.visit_id}#documents`} className="mt-1 inline-block text-[13px] font-medium text-brand-700 hover:underline">
                        Open case
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" icon={<Activity className="size-4" />} />
            {!data && loading ? (
              <ListSkeleton rows={4} />
            ) : data && data.activity.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-3 px-5 py-4">
                {data?.activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-[13px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800">
                        {a.label}{" "}
                        <span className="text-slate-500">
                          · {a.resource_type} #{a.resource_id}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">{timeAgo(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Stat({
  label,
  value,
  icon,
  href,
  emphasis,
  tone,
}: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  href: string;
  emphasis?: boolean;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-(--shadow-card) transition-colors hover:border-slate-300"
    >
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[13px] font-medium">{label}</span>
        <span className={tone === "danger" ? "text-rose-600" : emphasis ? "text-amber-600" : ""}>{icon}</span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-3 h-8 w-12" />
      ) : (
        <p className={`tnum mt-2 text-3xl font-semibold tracking-tight ${tone === "danger" ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
      )}
    </Link>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-5 py-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
