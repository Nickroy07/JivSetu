"use client";

import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PatientShell, { usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { clearPatientFlow, loadDraft } from "@/lib/session";

export default function CompletePage() {
  return (
    <PatientShell>
      <Complete />
    </PatientShell>
  );
}

function Complete() {
  const { tr } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  const [result, setResult] = useState<{ missing: string[]; urgent: boolean } | null>(null);

  useEffect(() => {
    if (!session) return;
    const r = loadDraft<{ missing: string[]; urgent: boolean }>(`result.${session.visitId}`);
    // Only show success when the server confirmed the submission.
    if (!r) router.replace("/patient/interview/review");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate confirmed result once
    else setResult(r);
  }, [session, router]);

  if (!session || !result) return null;

  return (
    <div className="animate-rise text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-leaf-50 text-leaf-600 ring-8 ring-leaf-50/50">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{tr("done_title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-[17px] leading-relaxed text-slate-600">{tr("done_body")}</p>

      {result.urgent && (
        <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 text-left" role="alert">
          <AlertOctagon className="mt-0.5 size-6 shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="font-semibold text-rose-900">{tr("urgent_title")}</p>
            <p className="mt-1 text-[15px] text-rose-900">{tr("urgent_body")}</p>
          </div>
        </div>
      )}

      <Card className="mx-auto mt-8 max-w-md p-5 text-left">
        <p className="text-sm text-slate-500">{tr("done_ref")}</p>
        <p className="tnum mt-1 font-mono text-3xl font-semibold tracking-wider text-slate-900">#{session.visitId}</p>
        {result.missing.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">{tr("done_missing")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {result.missing.map((m) => (
                <li key={m} className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">{m}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Button
        size="xl"
        variant="outline"
        className="mx-auto mt-8 w-full max-w-md"
        onClick={() => {
          clearPatientFlow();
          router.replace("/");
        }}
      >
        {tr("done_finish")}
      </Button>
    </div>
  );
}
