"use client";

import {
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  FileText,
  GitCompareArrows,
  History,
  RotateCcw,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiDraftCard from "@/components/doctor/AiDraftCard";
import ConflictResolver from "@/components/doctor/ConflictResolver";
import DocumentPanel from "@/components/doctor/DocumentPanel";
import AssessmentForm, { type AyushLang } from "@/components/ayush/AssessmentForm";
import DoctorShell, { useStaff } from "@/components/doctor/DoctorShell";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { ApiError, api, errorMessage } from "@/lib/api";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/session";
import { formatDate, humanize } from "@/lib/status";
import type { CompleteCase, DocumentItem, RedFlagItem, SourceRef } from "@/lib/types";

interface ReviewDraft {
  notes: string;
  edits: Record<string, string>;
}

export default function CasePage() {
  return (
    <DoctorShell>
      <CaseContent />
    </DoctorShell>
  );
}

function CaseContent() {
  const { visit_id } = useParams<{ visit_id: string }>();
  const { token, role } = useStaff();
  const [ayushLang, setAyushLang] = useState<AyushLang>("en");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportFhir() {
    setExporting(true);
    setExportError(null);
    try {
      const bundle = await api<unknown>(`/fhir/visits/${visit_id}/bundle`, { token });
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `jivsetu-visit-${visit_id}-fhir.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const draftKey = `review.${visit_id}`;

  const [data, setData] = useState<CompleteCase | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [notes, setNotes] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const initialised = useRef(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoadError(null);
      try {
        const res = await api<CompleteCase>(`/clinical-history/visits/${visit_id}/complete`, { token });
        setData(res);
        if (!initialised.current) {
          initialised.current = true;
          const server: ReviewDraft = {
            notes: res.clinical_history?.physician_notes ?? "",
            edits: res.clinical_history?.doctor_edits ?? {},
          };
          const local = loadLocalDraft<ReviewDraft>(draftKey);
          if (local && JSON.stringify(local) !== JSON.stringify(server)) {
            setNotes(local.notes);
            setEdits(local.edits);
            setRestored(true);
          } else {
            setNotes(server.notes);
            setEdits(server.edits);
          }
          setReady(true);
        }
      } catch (err) {
        if (!quiet) setLoadError(err instanceof ApiError ? err : new ApiError(errorMessage(err), 0));
      }
    },
    [visit_id, token, draftKey]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load();
  }, [load]);

  // Poll while documents are still being read.
  const processing = data?.documents.some((d) => d.processing) ?? false;
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => load(true), 4000);
    return () => clearInterval(t);
  }, [processing, load]);

  const history = data?.clinical_history ?? null;
  const serverDraft = useMemo<ReviewDraft>(
    () => ({ notes: history?.physician_notes ?? "", edits: history?.doctor_edits ?? {} }),
    [history]
  );
  const cleanEdits = useMemo(() => Object.fromEntries(Object.entries(edits).filter(([, v]) => v.trim())), [edits]);
  const dirty = ready && JSON.stringify({ notes, edits: cleanEdits }) !== JSON.stringify(serverDraft);

  // Persist unsaved work locally so a failed save or refresh never loses it.
  useEffect(() => {
    if (!ready) return;
    if (dirty) saveLocalDraft(draftKey, { notes, edits: cleanEdits });
    else clearLocalDraft(draftKey);
  }, [ready, dirty, notes, cleanEdits, draftKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit(status: "accepted" | "amended" | "rejected" | "pending" | null, label: string) {
    if (!history) return;
    if (status === "rejected" && !notes.trim()) {
      setSaveError("Add a note explaining what needs to change before returning the history.");
      return;
    }
    setSaving(label);
    setSaveError(null);
    setSaved(null);
    try {
      const res = await api<{ clinical_history: CompleteCase["clinical_history"]; visit_status: string }>(
        `/clinical-history/visits/${visit_id}/review`,
        {
          method: "PATCH",
          token,
          json: {
            physician_status: status,
            physician_notes: notes,
            doctor_edits: cleanEdits,
            expected_updated_at: history.updated_at,
          },
        }
      );
      clearLocalDraft(draftKey);
      setRestored(false);
      setData((d) => (d ? { ...d, clinical_history: res.clinical_history, visit: { ...d.visit, status: res.visit_status } } : d));
      setSaved(label);
    } catch (err) {
      setSaveError(`${errorMessage(err)} Your notes and edits are kept on this screen.`);
    } finally {
      setSaving(null);
    }
  }

  const onDocChanged = (doc?: DocumentItem) => {
    if (doc) setData((d) => (d ? { ...d, documents: d.documents.map((x) => (x.id === doc.id ? { ...x, ...doc } : x)) } : d));
    load(true);
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Alert
          tone="danger"
          title={loadError.status === 404 ? "Case not found" : "Couldn’t load this case"}
          action={loadError.status !== 404 && <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>}
        >
          {loadError.status === 404 ? "This visit does not exist or was removed." : loadError.message}
        </Alert>
        <Link href="/doctor/queue" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
          <ArrowLeft className="size-4" /> Back to queue
        </Link>
      </div>
    );
  }

  if (!data) return <CaseSkeleton />;

  const summary = data.draft_summary;
  const flags = (history?.red_flags ?? []).map((f) => (typeof f === "string" ? ({ message: f } as RedFlagItem) : f));
  const decided = history && history.physician_status !== "pending";
  const openConflicts = (summary?.conflicts ?? []).filter((c) => !data.conflict_resolutions?.[c.field]).length;

  return (
    <>
      <Link href="/doctor/queue" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Patient queue
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{data.patient.full_name ?? `Patient #${data.patient.id}`}</h1>
            <StatusBadge kind="visit" status={data.visit.status} />
            {history && <StatusBadge kind="review" status={history.physician_status} />}
          </div>
          <p className="tnum mt-1 text-sm text-slate-500">
            Visit #{data.visit.id} · {formatDate(data.visit.visit_date)} · Patient #{data.patient.id}
            {data.patient.mobile && ` · +91 ${data.patient.mobile}`} ·{" "}
            <Link href={`/doctor/patient/${data.patient.id}`} className="text-brand-700 hover:underline">All visits</Link> ·{" "}
            <Link href={`/doctor/monitoring?patient_id=${data.patient.id}`} className="font-semibold text-brand-700 hover:underline">📈 Health Trends</Link>
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center sm:flex">
          <Metric label="Answers" value={data.stats.interview_answers_total} />
          <Metric label="Flags" value={data.stats.red_flags_total} tone={data.stats.red_flags_total ? "danger" : undefined} />
          <Metric label="Missing" value={data.stats.missing_total} tone={data.stats.missing_total ? "warning" : undefined} />
          <Metric label="Conflicts" value={data.stats.conflicts_total} tone={data.stats.conflicts_total ? "warning" : undefined} />
        </div>
      </div>

      {restored && (
        <Alert tone="info" className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => { setNotes(serverDraft.notes); setEdits(serverDraft.edits); setRestored(false); clearLocalDraft(draftKey); }}>Discard</Button>}>
          Restored unsaved review changes from this browser.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {!history ? (
            <Card>
              <EmptyState
                icon={<UserRound className="size-5" />}
                title="Interview not submitted yet"
                description="The patient has checked in but has not completed the guided interview. This page updates when they submit."
                action={<Button variant="outline" size="sm" onClick={() => load()}>Check again</Button>}
              />
            </Card>
          ) : (
            <>
              {flags.length > 0 && (
                <Card className="border-rose-200">
                  <CardHeader title="Screening flags" description="Rule-based checks on patient-reported answers. Not a diagnosis." icon={<AlertOctagon className="size-4 text-rose-600" />} />
                  <ul className="divide-y divide-slate-100">
                    {flags.map((f, i) => (
                      <li key={f.code ?? i} className="flex items-start gap-3 px-5 py-3 text-sm">
                        <Badge tone={f.severity === "urgent" ? "danger" : "warning"}>{f.severity === "urgent" ? "Urgent" : "Attention"}</Badge>
                        <div>
                          <p className="text-slate-900">{f.message ?? f.code}</p>
                          {f.question_id && <p className="text-xs text-slate-500">From answer: {humanize(f.question_id)} = “{humanize(f.answer)}”</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {summary && (
                <Card>
                  <CardHeader
                    title="Draft clinical history"
                    description={summary.disclaimer}
                    icon={<Sparkles className="size-4 text-violet-600" />}
                    actions={<Badge tone="violet">Auto-generated draft</Badge>}
                  />
                  <CardBody className="border-b border-slate-100 bg-violet-50/30">
                    <p className="text-[15px] leading-relaxed text-slate-800">{summary.narrative}</p>
                  </CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-100 text-xs text-slate-500">
                        <tr>
                          <th className="w-[26%] px-5 py-2 font-medium">Item</th>
                          <th className="w-[30%] px-3 py-2 font-medium"><span className="inline-flex items-center gap-1"><UserRound className="size-3" /> Patient reported</span></th>
                          <th className="px-5 py-2 font-medium"><span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3" /> Clinician-confirmed value</span></th>
                        </tr>
                      </thead>
                      {summary.sections.map((section) => (
                        <tbody key={section.title} className="divide-y divide-slate-100">
                          <tr className="bg-slate-50/70">
                            <th colSpan={3} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</th>
                          </tr>
                          {section.items.map((item) => (
                            <tr key={item.field} className="align-top">
                              <td className="px-5 py-2.5 text-slate-600">{item.label}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-900">{item.value}</td>
                              <td className="px-5 py-1.5">
                                <Input
                                  value={edits[item.field] ?? ""}
                                  onChange={(e) => setEdits((x) => ({ ...x, [item.field]: e.target.value }))}
                                  placeholder="Same as patient"
                                  aria-label={`Clinician value for ${item.label}`}
                                  className="h-8 text-sm"
                                  disabled={!!decided}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </Card>
              )}

              {history && <AiDraftCard visitId={visit_id} token={token} />}

              {summary && summary.clinical_considerations && summary.clinical_considerations.length > 0 && (
                <Card className="border-brand-200">
                  <CardHeader
                    title="Clinical Evidence Reconciliation & Disease Considerations"
                    description="Source-linked evidence evaluated against cited clinical criteria. For clinician review — not an automated diagnosis."
                    icon={<Sparkles className="size-4 text-brand-600" />}
                    actions={<Badge tone="brand">Hybrid Rules Engine</Badge>}
                  />
                  <div className="divide-y divide-slate-100">
                    {summary.clinical_considerations.map((c, i) => (
                      <div key={i} className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-900 text-base">{c.disease}</h3>
                          <Badge
                            tone={
                              c.status.includes("urgent") || c.status.includes("warning") || c.status === "diabetes_range"
                                ? "danger"
                                : c.status === "prediabetes_range"
                                ? "warning"
                                : "brand"
                            }
                          >
                            {humanize(c.status).toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-snug">{c.headline}</p>

                        <div className="space-y-1.5 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supporting Source Evidence</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {c.evidence.map((ev, idx) => (
                              <div key={idx} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs">
                                <div className="flex justify-between font-medium text-slate-800">
                                  <span>{ev.label}</span>
                                  <span className="font-semibold text-brand-900">{ev.value}</span>
                                </div>
                                {ev.source && (
                                  <div className="mt-1">
                                    <SourceLine source={ev.source} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {c.guideline && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-900">Cited Guideline: </span>
                            {c.guideline}
                          </div>
                        )}

                        {c.missing_or_conflicts && c.missing_or_conflicts.length > 0 && (
                          <div className="space-y-1">
                            {c.missing_or_conflicts.map((note, nIdx) => (
                              <p key={nIdx} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                                <strong>Clinical Note:</strong> {note}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {summary && (summary.conflicts.length > 0 || summary.missing_information.length > 0) && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader title="Conflicting information" description="Shown as reported — nothing was auto-resolved." icon={<GitCompareArrows className="size-4 text-amber-600" />} />
                    {summary.conflicts.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-500">No conflicts between answers and documents.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {summary.conflicts.map((c) => (
                          <li key={c.field} className="space-y-2 px-5 py-3 text-sm">
                            <p className="font-medium text-slate-900">{c.message}</p>
                            <SourceLine source={c.patient} />
                            {c.documents.map((d, i) => <SourceLine key={i} source={d} />)}
                            <ConflictResolver
                              visitId={visit_id}
                              field={c.field}
                              token={token}
                              resolution={data.conflict_resolutions?.[c.field] ?? null}
                              onSaved={(all) => setData((d) => (d ? { ...d, conflict_resolutions: all } : d))}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                  <Card>
                    <CardHeader title="Missing information" description="Ask during consultation." icon={<CircleHelp className="size-4 text-amber-600" />} />
                    {summary.missing_information.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-500">All core history items were answered.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {summary.missing_information.map((m) => (
                          <li key={m.field} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                            <span className="text-slate-800">{m.label} <span className="text-xs text-slate-500">· {m.section}</span></span>
                            <Badge tone={m.reason === "Not answered" ? "neutral" : "warning"}>{m.reason}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              )}
            </>
          )}

          <Card id="documents" className="scroll-mt-6">
            <CardHeader
              title="Medical documents"
              description={`${data.stats.documents_processed} of ${data.stats.documents_total} processed${data.stats.documents_failed ? ` · ${data.stats.documents_failed} need attention` : ""}`}
              icon={<FileText className="size-4" />}
            />
            {data.documents.length === 0 ? (
              <EmptyState icon={<FileText className="size-5" />} title="No documents uploaded" description="The patient did not upload prescriptions or reports for this visit." />
            ) : (
              <div className="space-y-3 p-4">
                {data.documents.map((d) => (
                  <DocumentPanel key={d.id} doc={d} token={token} onChanged={onDocChanged} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="AYUSH assessment"
              description="Structured Trividha, Ashtavidha and Dashavidha documentation. No score or diagnosis is generated."
              actions={
                <div className="flex gap-1" role="group" aria-label="Assessment language">
                  {(["en", "hi", "mr"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setAyushLang(l)}
                      aria-pressed={ayushLang === l}
                      className={`rounded-md px-2 py-1 text-xs font-medium ${ayushLang === l ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              }
            />
            <CardBody>
              <AssessmentForm visitId={visit_id} token={token} lang={ayushLang} canVerify={role === "doctor"} />
            </CardBody>
          </Card>
        </div>

        {/* Review panel */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader title="Clinician review" icon={<History className="size-4" />} />
            <CardBody className="space-y-4">
              {history ? (
                <>
                  <dl className="space-y-1.5 text-[13px]">
                    <Row k="Status"><StatusBadge kind="review" status={history.physician_status} /></Row>
                    <Row k="Submitted">{formatDate(history.created_at, true)}</Row>
                    <Row k="Last reviewed">{history.reviewed_at ? `${formatDate(history.reviewed_at, true)} · ${history.reviewed_by}` : "Not yet"}</Row>
                    <Row k="Clinician edits">{Object.keys(cleanEdits).length}</Row>
                  </dl>
                  <div>
                    <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-800">Clinical notes</label>
                    <Textarea id="notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assessment, follow-up questions, plan…" />
                  </div>

                  {saveError && <Alert tone="danger">{saveError}</Alert>}
                  {saved && !dirty && <Alert tone="success">{saved} — saved.</Alert>}
                  {dirty && <p className="text-xs text-amber-700">Unsaved changes (kept in this browser until saved).</p>}

                  {decided ? (
                    <Button variant="outline" className="w-full" onClick={() => submit("pending", "Review reopened")} loading={saving === "Review reopened"}>
                      <RotateCcw className="size-4" /> Reopen review
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {openConflicts > 0 && (
                        <Alert tone="warning">
                          {openConflicts} conflicting {openConflicts === 1 ? "item needs" : "items need"} a recorded decision and reason before you can accept.
                        </Alert>
                      )}
                      <Button
                        variant="success"
                        className="w-full"
                        onClick={() => {
                          const amended = Object.keys(cleanEdits).length > 0;
                          submit(amended ? "amended" : "accepted", amended ? "Accepted with edits" : "Accepted");
                        }}
                        loading={saving?.startsWith("Accepted")}
                        disabled={!!saving || openConflicts > 0}
                      >
                        <CheckCircle2 className="size-4" /> {Object.keys(cleanEdits).length ? "Accept with edits" : "Accept history"}
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => submit(null, "Draft")} loading={saving === "Draft"} disabled={!!saving || !dirty}>
                          <Save className="size-4" /> Save draft
                        </Button>
                        <Button variant="outline" className="text-rose-700" onClick={() => submit("rejected", "Returned")} loading={saving === "Returned"} disabled={!!saving}>
                          Return
                        </Button>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-500">
                        Accepting confirms you reviewed the patient-reported history. Patient answers are preserved; your edits are stored separately.
                      </p>
                    </div>
                  )}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <Button variant="outline" size="sm" className="w-full" onClick={exportFhir} loading={exporting}>
                      Export FHIR R4 (JSON)
                    </Button>
                    {exportError && <p className="mt-2 text-xs text-rose-700">{exportError}</p>}
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Draft export for interoperability. Unreviewed items are marked unconfirmed or preliminary.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Review becomes available once the patient submits the interview.</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function SourceLine({ source }: { source: SourceRef }) {
  const isDoc = source.type === "document";
  return (
    <div className="flex items-start gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px]">
      <Badge tone={isDoc ? "brand" : "neutral"}>{isDoc ? "Document" : "Patient"}</Badge>
      <div className="min-w-0">
        <p className="text-slate-800">{source.value ?? "—"}</p>
        {isDoc && (
          <p className="truncate text-xs text-slate-500">
            <a href={`#doc-${source.document_id}`} className="text-brand-700 hover:underline">{source.filename}</a>
            {source.source_text && <span className="font-mono"> · “{source.source_text}”</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "text-rose-700" : tone === "warning" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 sm:min-w-20">
      <p className={`tnum text-lg font-semibold ${color}`}>{value ?? 0}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
