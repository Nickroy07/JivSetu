"use client";

import { Activity, CheckCircle2, ChevronRight, FileText, HeartPulse, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DoctorShell, { PageHeader, useStaff } from "@/components/doctor/DoctorShell";
import AssessmentForm, { AyushLang } from "@/components/ayush/AssessmentForm";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";
import { api, errorMessage } from "@/lib/api";
import { formatDate, humanize } from "@/lib/status";
import type { QueueResponse } from "@/lib/types";

export default function AyurvedaDashboardPage() {
  return (
    <DoctorShell>
      <AyurvedaContent />
    </DoctorShell>
  );
}

function AyurvedaContent() {
  const { token, role } = useStaff();
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [lang, setLang] = useState<AyushLang>("en");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await api<QueueResponse>("/doctor/queue?scope=all&page_size=30", { token });
      setQueue(q);
      if (q.items.length > 0 && !selectedVisitId) {
        setSelectedVisitId(q.items[0].visit_id);
        setSelectedPatientName(q.items[0].full_name);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, selectedVisitId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const filteredItems = queue?.items.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.full_name.toLowerCase().includes(term) ||
      String(item.visit_id).includes(term) ||
      (item.chief_complaint && item.chief_complaint.toLowerCase().includes(term))
    );
  }) ?? [];

  return (
    <>
      <PageHeader
        title="Ayurveda Clinical Assessment"
        description="Standardized Trividha, Ashtavidha, and Dashavidha Pariksha documentation and verification."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              {(["en", "hi", "mr"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    lang === l ? "bg-brand-600 text-white font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {l === "en" ? "EN" : l === "hi" ? "हिन्दी" : "मराठी"}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadQueue}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <Alert tone="danger" title="Error loading cases" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 border-l-4 border-l-brand-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trividha Pariksha</p>
          <p className="mt-1 text-sm font-medium text-slate-800">Darshana · Sparshana · Prashna</p>
          <p className="mt-1 text-xs text-slate-500">Three-fold examination of patient and illness.</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-leaf-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ashtavidha Pariksha</p>
          <p className="mt-1 text-sm font-medium text-slate-800">Nadi, Mala, Mutra, Jihva, Shabda, Sparsha, Drik, Akriti</p>
          <p className="mt-1 text-xs text-slate-500">Eight-fold systemic clinical diagnosis.</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dashavidha Pariksha</p>
          <p className="mt-1 text-sm font-medium text-slate-800">Prakriti, Vikriti, Sara, Samhanana, Satmya, Ahara Shakti…</p>
          <p className="mt-1 text-xs text-slate-500">Ten-fold examination of constitution and vitality.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Patient Encounter Picker */}
        <div className="space-y-3">
          <Card className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient or visit..."
                className="h-9 pl-9 text-sm"
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Patients ({filteredItems.length})
              </span>
            </div>
            {loading && !queue ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">No matching patient visits.</p>
            ) : (
              <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                {filteredItems.map((item) => {
                  const isSelected = item.visit_id === selectedVisitId;
                  return (
                    <li key={item.visit_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVisitId(item.visit_id);
                          setSelectedPatientName(item.full_name);
                        }}
                        className={`flex w-full items-start justify-between p-3 text-left transition-colors ${
                          isSelected ? "bg-brand-50/80 border-l-4 border-brand-600" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${isSelected ? "font-semibold text-brand-900" : "font-medium text-slate-900"}`}>
                            {item.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            Visit #{item.visit_id} · {item.chief_complaint ? humanize(item.chief_complaint) : "No complaint"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">{formatDate(item.visit_date)}</p>
                        </div>
                        <ChevronRight className={`size-4 shrink-0 mt-1 ${isSelected ? "text-brand-600" : "text-slate-300"}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right: Active Ayurveda Assessment Form */}
        <div>
          {selectedVisitId ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedPatientName} · Visit #{selectedVisitId}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clinical documentation for traditional Ayurvedic diagnosis. All observations are clinician-verified.
                  </p>
                </div>
                <Link
                  href={`/doctor/cases/${selectedVisitId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
                >
                  <FileText className="size-3.5" /> Full case history &amp; documents
                </Link>
              </div>

              <Card className="p-5">
                <AssessmentForm
                  visitId={selectedVisitId}
                  token={token}
                  lang={lang}
                  canVerify={role === "doctor" || role === "admin"}
                />
              </Card>
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<HeartPulse className="size-6 text-brand-600" />}
                title="Select a patient visit"
                description="Choose a patient from the list on the left to start or review their Trividha, Ashtavidha, and Dashavidha Pariksha."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}