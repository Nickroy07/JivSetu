"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import AssessmentForm from "@/components/ayush/AssessmentForm";
import PatientShell, { usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const TITLE = {
  en: ["Additional Ayurvedic questions", "Optional. Your answers help the practitioner. You can skip anything."],
  hi: ["आयुर्वेदिक प्रश्न (वैकल्पिक)", "वैकल्पिक। आपके उत्तर चिकित्सक की मदद करते हैं। किसी भी प्रश्न को छोड़ सकते हैं।"],
  mr: ["अतिरिक्त आयुर्वेदिक प्रश्न (ऐच्छिक)", "ऐच्छिक. तुमची उत्तरे वैद्यांना मदत करतात. कोणताही प्रश्न सोडू शकता."],
} as const;
const BACK = { en: "Back", hi: "वापस", mr: "मागे" } as const;

export default function PatientAyushPage() {
  return (
    <PatientShell>
      <Inner />
    </PatientShell>
  );
}

function Inner() {
  const { lang } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  if (!session) return null;
  const [title, body] = TITLE[lang];
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-[17px] text-slate-600">{body}</p>
      <Card className="mt-6 p-5">
        <AssessmentForm visitId={session.visitId} token={session.token} lang={lang} />
      </Card>
      <Button variant="outline" size="lg" className="mt-6" onClick={() => router.back()}>
        <ArrowLeft className="size-4" aria-hidden /> {BACK[lang]}
      </Button>
    </div>
  );
}
