"use client";

import { ArrowLeft, FlaskConical, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import PatientShell, { PatientHeading, usePatientLang } from "@/components/patient/PatientShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api, errorMessage } from "@/lib/api";
import { PendingVerification, clearDraft, loadDraft, saveDraft, setPatientSession } from "@/lib/session";

const RESEND_SECONDS = 30;

interface VerifyResponse {
  access_token: string;
  patient_id: number;
  visit_id: number;
  mobile: string;
}

export default function OtpPage() {
  return (
    <PatientShell step={0}>
      <OtpForm />
    </PatientShell>
  );
}

function OtpForm() {
  const { tr } = usePatientLang();
  const router = useRouter();
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = loadDraft<PendingVerification>("pending");
    if (!p) {
      router.replace("/patient/register");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate pending verification once
    setPending(p);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [router]);

  const wait = pending ? Math.max(0, RESEND_SECONDS - Math.floor((now - pending.sentAt) / 1000)) : 0;

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    if (!/^\d{6}$/.test(code)) {
      setError(tr("otp_label"));
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<VerifyResponse>("/auth/patient/verify-otp", {
        json: { mobile: pending.mobile, otp: code, name: pending.name },
      });
      setPatientSession({
        token: res.access_token,
        patientId: res.patient_id,
        visitId: res.visit_id,
        name: pending.name,
        mobile: res.mobile,
      });
      clearDraft("pending");
      router.push("/patient/consent");
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function resend() {
    if (!pending) return;
    setResending(true);
    setError(null);
    try {
      const res = await api<{ delivery: "sms" | "development"; dev_otp?: string }>("/auth/patient/resend-otp", {
        json: { mobile: pending.mobile },
      });
      const next = { ...pending, delivery: res.delivery, devOtp: res.dev_otp, sentAt: Date.now() };
      saveDraft("pending", next);
      setPending(next);
      setNow(Date.now());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  if (!pending) return null;

  return (
    <form onSubmit={verify} noValidate className="animate-rise">
      <Link href="/patient/register" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> {tr("change_number")}
      </Link>
      <PatientHeading title={tr("otp_title")} />

      {pending.delivery === "development" && pending.devOtp ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <FlaskConical className="size-4" aria-hidden /> {tr("otp_dev_title")}
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {tr("otp_dev_body")}{" "}
            <span className="tnum rounded bg-white px-2 py-0.5 font-mono text-base font-semibold tracking-[0.2em] ring-1 ring-amber-300">{pending.devOtp}</span>
          </p>
        </div>
      ) : (
        <p className="mb-6 flex items-center gap-2 text-[17px] text-slate-600">
          <MessageSquareText className="size-5 text-brand-600" aria-hidden />
          {tr("otp_body_sms")} <span className="tnum font-medium text-slate-900">+91 {pending.mobile}</span>
        </p>
      )}

      <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-slate-800">{tr("otp_label")}</label>
      <Input
        id="otp"
        ref={inputRef}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        aria-invalid={error ? true : undefined}
        className="tnum h-14 text-center font-mono text-2xl tracking-[0.5em]"
      />
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}

      <Button type="submit" size="xl" className="mt-6 w-full" loading={loading} disabled={code.length !== 6}>
        {tr("verify")}
      </Button>
      <div className="mt-4 text-center">
        {wait > 0 ? (
          <p className="tnum text-sm text-slate-500">{tr("resend_in")} {wait}s</p>
        ) : (
          <Button variant="ghost" onClick={resend} loading={resending}>{tr("resend")}</Button>
        )}
      </div>
    </form>
  );
}
