"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, errorMessage } from "@/lib/api";
import { PendingVerification, loadDraft, saveDraft } from "@/lib/session";

export default function RegisterPage() {
  return (
    <PatientShell step={0}>
      <RegisterForm />
    </PatientShell>
  );
}

function RegisterForm() {
  const { tr } = usePatientLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = loadDraft<{ name: string; mobile: string }>("register");
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore draft once
      setName(d.name);
      setMobile(d.mobile);
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanMobile = mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const next: typeof errors = {};
    if (cleanName.length < 2) next.name = tr("err_name");
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) next.mobile = tr("err_mobile");
    setErrors(next);
    if (Object.keys(next).length) return;

    saveDraft("register", { name: cleanName, mobile: cleanMobile });
    setLoading(true);
    setServerError(null);
    try {
      const res = await api<{ delivery: "sms" | "development"; dev_otp?: string }>("/auth/patient/send-otp", {
        json: { mobile: cleanMobile },
      });
      const pending: PendingVerification = {
        name: cleanName,
        mobile: cleanMobile,
        delivery: res.delivery,
        devOtp: res.dev_otp,
        sentAt: Date.now(),
      };
      saveDraft("pending", pending);
      router.push("/patient/otp");
    } catch (err) {
      setServerError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="animate-rise">
      <Link href="/patient" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> {tr("back")}
      </Link>
      <PatientHeading title={tr("register_title")} body={tr("register_body")} />
      <div className="space-y-5">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <Field label={tr("name_label")} hint={tr("name_hint")} error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} className="h-12 text-lg" />}
        </Field>
        <Field label={tr("mobile_label")} hint={tr("mobile_hint")} error={errors.mobile}>
          {(p) => (
            <div className="flex">
              <span className="inline-flex h-12 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-lg text-slate-600">+91</span>
              <Input
                {...p}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d\s]/g, ""))}
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={12}
                className="tnum h-12 rounded-l-none text-lg tracking-wide"
              />
            </div>
          )}
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={loading}>
          {tr("send_code")}
        </Button>
      </div>
    </form>
  );
}
