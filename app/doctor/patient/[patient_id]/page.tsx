"use client";

import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { formatDate, humanize } from "@/lib/status";

interface PatientResponse {
  patient: { id: number; full_name: string; mobile: string };
  visits: { id: number; visit_date: string | null; status: string; chief_complaint: string | null; physician_status: string | null }[];
}

export default function PatientHistoryPage() {
  return (
    <DoctorShell>
      <Content />
    </DoctorShell>
  );
}

function Content() {
  const { patient_id } = useParams<{ patient_id: string }>();
  const { token } = useStaff();
  const [data, setData] = useState<PatientResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<PatientResponse>(`/doctor/patients/${encodeURIComponent(patient_id)}`, { token }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [patient_id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load();
  }, [load]);

  return (
    <>
      <Link href="/doctor/queue" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Patient queue
      </Link>
      {error ? (
        <Alert tone="danger" title="Couldn’t load patient" action={<Button size="sm" variant="outline" onClick={load}>Retry</Button>}>{error}</Alert>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <PageHeader title={data.patient.full_name} description={`Patient #${data.patient.id} · +91 ${data.patient.mobile} · ${data.visits.length} visit(s)`} />
          <Card>
            {data.visits.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-5" />} title="No visits recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.visits.map((v) => (
                  <li key={v.id}>
                    <Link href={`/doctor/cases/${v.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{formatDate(v.visit_date)} · Visit #{v.id}</p>
                        <p className="text-[13px] text-slate-500">{v.chief_complaint ? humanize(v.chief_complaint) : "No complaint recorded"}</p>
                      </div>
                      <StatusBadge kind="visit" status={v.status} />
                      {v.physician_status && <StatusBadge kind="review" status={v.physician_status} />}
                      <ArrowRight className="size-4 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
