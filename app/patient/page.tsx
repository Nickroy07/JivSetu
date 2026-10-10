"use client";

import { ArrowRight, Clock, Mic, Stethoscope } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import Alert from "@/components/ui/Alert";
import { LinkButton } from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function PatientWelcomePage() {
  return (
    <PatientShell>
      <Suspense>
        <Welcome />
      </Suspense>
    </PatientShell>
  );
}

function Welcome() {
  const { tr } = usePatientLang();
  const params = useSearchParams();

  return (
    <div className="animate-rise">
      {params.get("expired") && (
        <Alert tone="info" className="mb-6">{tr("session_missing")}</Alert>
      )}
      <PatientHeading title={tr("welcome_title")} body={tr("welcome_body")} />
      <Card className="divide-y divide-slate-100">
        {[
          { icon: Clock, text: tr("welcome_points_1") },
          { icon: Mic, text: tr("welcome_points_2") },
          { icon: Stethoscope, text: tr("welcome_points_3") },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-4 px-5 py-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-[17px] text-slate-800">{text}</span>
          </div>
        ))}
      </Card>
      <p className="mt-8 text-sm text-slate-500">{tr("choose_language")} ↑</p>
      <LinkButton href="/patient/register" size="xl" className="mt-3 w-full">
        {tr("start")} <ArrowRight className="size-5" />
      </LinkButton>
    </div>
  );
}
