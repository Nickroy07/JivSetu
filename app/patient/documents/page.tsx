"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, FileText, RotateCw, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { api, errorMessage, uploadWithProgress } from "@/lib/api";
import { DOC_TYPES, formatBytes } from "@/lib/status";
import type { DocumentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const PATIENT_DOC_TYPES = ["prescription", "lab_report", "discharge_summary", "xray_report", "other"];
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

interface Capabilities {
  max_upload_mb: number;
  image_ocr_available: boolean;
}

export default function DocumentsPage() {
  return (
    <PatientShell step={3}>
      <Documents />
    </PatientShell>
  );
}

function Documents() {
  const { tr } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("prescription");
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const res = await api<{ documents: DocumentItem[] }>(`/documents/patient/${session.patientId}`, { token: session.token });
      setDocs(res.documents);
    } catch (err) {
      setError(errorMessage(err));
      setDocs((d) => d ?? []);
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load();
    api<Capabilities>("/documents/capabilities").then(setCaps).catch(() => setCaps(null));
  }, [load]);

  const processing = docs?.some((d) => d.processing);
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [processing, load]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setError(null);
    setNotice(null);
    const max = (caps?.max_upload_mb ?? 10) * 1024 * 1024;
    if (file.size > max) {
      setError(tr("file_rules", { mb: caps?.max_upload_mb ?? 10 }));
      return;
    }
    const form = new FormData();
    form.append("patient_id", String(session.patientId));
    form.append("visit_id", String(session.visitId));
    form.append("document_type", docType);
    form.append("file", file);
    setProgress(0);
    try {
      const res = await uploadWithProgress<{ duplicate: boolean; document: DocumentItem }>(
        "/documents/upload",
        form,
        session.token,
        setProgress
      );
      if (res.duplicate) setNotice(tr("duplicate"));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  async function retry(id: number) {
    if (!session) return;
    setRetrying(id);
    setError(null);
    try {
      await api(`/documents/${id}/retry`, { method: "POST", token: session.token });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRetrying(null);
    }
  }

  if (!session) return null;
  const uploading = progress !== null;

  return (
    <div className="animate-rise">
      <PatientHeading title={tr("docs_title")} body={tr("docs_body")} />

      <Card className="p-5">
        <p className="mb-3 text-sm font-medium text-slate-800">{tr("doc_type")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("doc_type")}>
          {PATIENT_DOC_TYPES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={docType === t}
              onClick={() => setDocType(t)}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-[15px] font-medium transition-colors",
                docType === t ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              {DOC_TYPES[t]}
            </button>
          ))}
        </div>

        <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-5 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-70"
        >
          {uploading ? (
            <>
              <Spinner className="size-6 text-brand-600" />
              <span className="tnum text-[15px] font-medium text-slate-800">
                {tr("uploading")} {Math.round((progress ?? 0) * 100)}%
              </span>
              <span className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full bg-brand-600 transition-all" style={{ width: `${(progress ?? 0) * 100}%` }} />
              </span>
            </>
          ) : (
            <>
              <Upload className="size-6 text-brand-600" aria-hidden />
              <span className="text-[17px] font-medium text-slate-900">{tr("choose_file")}</span>
              <span className="text-sm text-slate-500">{tr("file_rules", { mb: caps?.max_upload_mb ?? 10 })}</span>
            </>
          )}
        </button>
        {caps && !caps.image_ocr_available && <p className="mt-3 text-[13px] text-slate-500">{tr("image_ocr_off")}</p>}
      </Card>

      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      {notice && <Alert tone="info" className="mt-4">{notice}</Alert>}

      <div className="mt-6 space-y-2">
        {docs === null ? (
          <div className="flex justify-center py-6 text-slate-400"><Spinner /></div>
        ) : docs.length === 0 ? (
          <p className="py-4 text-center text-[15px] text-slate-500">{tr("no_docs")}</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <FileText className="size-5 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-slate-900">{DOC_TYPES[d.document_type] ?? d.document_type}</p>
                <p className="truncate text-xs text-slate-500">{d.filename} · {formatBytes(d.file_size)}</p>
              </div>
              <DocState doc={d} />
              {d.can_retry && (
                <Button variant="outline" size="sm" onClick={() => retry(d.id)} loading={retrying === d.id} aria-label={tr("retry")}>
                  <RotateCw className="size-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Button variant="outline" size="xl" onClick={() => router.push("/patient/interview")} aria-label={tr("back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <Button size="xl" className="flex-1" onClick={() => router.push("/patient/interview/review")} disabled={uploading}>
          {docs && docs.length ? tr("continue_to_review") : tr("skip_documents")} <ArrowRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function DocState({ doc }: { doc: DocumentItem }) {
  const { tr } = usePatientLang();
  if (doc.processing)
    return <span className="flex items-center gap-1.5 text-sm text-sky-700"><Spinner className="size-4" /> {tr("reading")}</span>;
  if (doc.upload_status === "failed")
    return <span className="flex items-center gap-1.5 text-sm text-rose-700" title={doc.processing_error ?? ""}><XCircle className="size-4" /> {tr("read_failed")}</span>;
  if (doc.extraction?.status === "completed")
    return <span className="flex items-center gap-1.5 text-sm text-leaf-700"><CheckCircle2 className="size-4" /> {tr("read_ok")}</span>;
  return <span className="flex items-center gap-1.5 text-sm text-slate-600"><CheckCircle2 className="size-4" /> {tr("read_partial")}</span>;
}
