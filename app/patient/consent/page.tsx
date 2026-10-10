"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { api, errorMessage } from "@/lib/api";
import { saveDraft } from "@/lib/session";
import { cn } from "@/lib/utils";

const ITEMS = ["consent_1", "consent_2", "consent_3", "consent_4"] as const;

export default function ConsentPage() {
  return (
    <PatientShell step={1}>
      <Consent />
    </PatientShell>
  );
}

function Consent() {
  const { tr, lang } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function proceed() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await api("/patient/consent", {
        method: "POST",
        token: session.token,
        json: {
          visit_id: session.visitId,
          language: lang,
          purposes: { case_taking: true, document_processing: true, clinician_access: true, voice_input: true },
        },
      });
      await api(`/patient/visits/${session.visitId}/start-interview`, { method: "POST", token: session.token });
      saveDraft(`consent.${session.visitId}`, { agreedAt: new Date().toISOString(), version: "1.0" });
      router.push("/patient/interview");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <div className="animate-rise">
      <PatientHeading title={tr("consent_title")} body={tr("consent_body")} />
      <Card className="divide-y divide-slate-100">
        {ITEMS.map((k, i) => (
          <p key={k} className="flex gap-4 px-5 py-4 text-[17px] leading-relaxed text-slate-800">
            <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">{i + 1}</span>
            {tr(k)}
          </p>
        ))}
      </Card>

      <button
        type="button"
        role="checkbox"
        aria-checked={agreed}
        onClick={() => setAgreed((v) => !v)}
        className={cn(
          "mt-6 flex w-full items-center gap-4 rounded-lg border-2 px-5 py-4 text-left text-lg font-medium transition-colors",
          agreed ? "border-leaf-500 bg-leaf-50 text-leaf-700" : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
        )}
      >
        <span className={cn("flex size-7 items-center justify-center rounded-md border-2", agreed ? "border-leaf-600 bg-leaf-600 text-white" : "border-slate-400")}>
          {agreed && <Check className="size-5" />}
        </span>
        {tr("consent_agree")}
      </button>

      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <Button size="xl" className="mt-6 w-full" disabled={!agreed} loading={loading} onClick={proceed}>
        {tr("continue")}
      </Button>
    </div>
  );
}
