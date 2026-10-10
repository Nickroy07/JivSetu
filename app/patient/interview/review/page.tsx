"use client";

import { ArrowLeft, FileText, Pencil, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { api, errorMessage } from "@/lib/api";
import { evaluateRedFlags } from "@/lib/clinical/redFlags";
import { Answers, visibleQuestions } from "@/lib/interview";
import { loadDraft, saveDraft } from "@/lib/session";
import { DOC_TYPES } from "@/lib/status";
import type { DocumentItem } from "@/lib/types";

export default function ReviewPage() {
  return (
    <PatientShell step={4}>
      <Review />
    </PatientShell>
  );
}

function Review() {
  const { lang, tr } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const d = loadDraft<{ answers: Answers; index: number }>(`answers.${session.visitId}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate draft once
    setAnswers(d?.answers ?? {});
    api<{ documents: DocumentItem[] }>(`/documents/patient/${session.patientId}`, { token: session.token })
      .then((r) => setDocs(r.documents))
      .catch(() => setDocs([]));
  }, [session]);

  if (!session || answers === null) return null;

  const questions = visibleQuestions(answers);
  const answered = questions.filter((q) => answers[q.id]);

  function display(qid: string, value: string) {
    const q = questions.find((x) => x.id === qid);
    if (!q) return value;
    if (q.inputType === "yesNo") return value === "yes" ? tr("yes") : value === "no" ? tr("no") : tr("not_sure");
    const opt = q.options?.find((o) => o.id === value);
    return opt ? opt.label[lang] ?? opt.label.en : value;
  }

  function editQuestion(qid: string) {
    const idx = questions.findIndex((q) => q.id === qid);
    saveDraft(`answers.${session!.visitId}`, { answers, index: Math.max(0, idx) });
    router.push("/patient/interview");
  }

  async function submit() {
    if (!session || !answers) return;
    setSubmitting(true);
    setError(null);
    const flags = evaluateRedFlags(answers);
    try {
      const res = await api<{ success: boolean; missing_information: { label: string }[] }>("/clinical-history", {
        json: {
          patient_id: session.patientId,
          visit_id: session.visitId,
          chief_complaint: answers.chief_complaint ?? null,
          history_data: answers,
          red_flags: flags,
        },
        token: session.token,
      });
      if (!res?.success) throw new Error("not confirmed");
      saveDraft(`result.${session.visitId}`, {
        missing: res.missing_information.map((m) => m.label),
        urgent: flags.some((f) => f.severity === "urgent"),
      });
      router.push("/patient/complete");
    } catch (err) {
      // Answers stay in sessionStorage; nothing is lost.
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-rise">
      <PatientHeading title={tr("review_title")} body={tr("review_body")} />

      {answered.length === 0 ? (
        <Alert tone="warning" action={<Button size="sm" variant="outline" onClick={() => router.push("/patient/interview")}>{tr("back")}</Button>}>
          {tr("submit_failed_body")}
        </Alert>
      ) : (
        <Card className="divide-y divide-slate-100">
          {answered.map((q) => (
            <div key={q.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-500">{q.question[lang] ?? q.question.en}</p>
                <p className="mt-0.5 break-words text-[17px] font-medium text-slate-900">{display(q.id, answers[q.id])}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => editQuestion(q.id)} aria-label={`${tr("edit")}: ${q.question[lang] ?? q.question.en}`}>
                <Pencil className="size-4" /> {tr("edit")}
              </Button>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-800">{tr("documents")} ({docs.length})</p>
          <Button variant="ghost" size="sm" onClick={() => router.push("/patient/documents")}>
            <Pencil className="size-4" /> {tr("edit")}
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="text-[15px] text-slate-500">{tr("no_docs")}</p>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[15px] text-slate-700">
                <FileText className="size-4 text-slate-400" aria-hidden /> {DOC_TYPES[d.document_type] ?? d.document_type}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <Alert tone="danger" title={tr("submit_failed")} className="mt-6">
          {error} {tr("submit_failed_body")}
        </Alert>
      )}

      <div className="mt-10 flex items-center gap-3">
        <Button variant="outline" size="xl" onClick={() => router.push("/patient/documents")} aria-label={tr("back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <Button size="xl" className="flex-1" onClick={submit} loading={submitting} disabled={answered.length === 0}>
          {!submitting && <Send className="size-5" />} {submitting ? tr("submitting") : error ? tr("retry") : tr("submit")}
        </Button>
      </div>
    </div>
  );
}
