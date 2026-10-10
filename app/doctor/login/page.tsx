"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import Logo from "@/components/ui/Logo";
import { api, errorMessage } from "@/lib/api";
import { getStaffSession, setStaffSession } from "@/lib/session";

interface LoginResponse {
  access_token: string;
  role: string;
  user_id: string;
  display_name: string | null;
  expires_in: number;
}

function safeNext(next: string | null) {
  return next && next.startsWith("/doctor") && !next.startsWith("/doctor/login") ? next : "/doctor";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getStaffSession()) router.replace(next);
  }, [router, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !password) {
      setError("Enter your staff ID and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new URLSearchParams({ username: userId.trim(), password });
      const res = await api<LoginResponse>("/auth/login", { method: "POST", form });
      setStaffSession({
        token: res.access_token,
        userId: res.user_id,
        role: res.role,
        displayName: res.display_name || res.user_id,
        expiresAt: Date.now() + res.expires_in * 1000 - 30_000,
      });
      router.replace(next);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {params.get("expired") && !error && (
        <Alert tone="info">Your session ended. Please sign in again.</Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Staff ID">
        {(p) => (
          <Input {...p} autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus />
        )}
      </Field>
      <Field label="Password">
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}

export default function DoctorLoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col bg-white px-4 py-8 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Logo />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">Clinician sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">Access the patient queue and case review workspace.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="size-3.5" aria-hidden />
            Accounts are issued by your hospital administrator. Activity is audit-logged.
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_30%,rgba(36,119,163,0.45),transparent)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-2xl font-medium leading-snug tracking-tight">
            “Review the patient’s own words, the documents they brought, and what’s still missing — in one place.”
          </p>
          <p className="mt-4 text-sm text-brand-200">Jivsetu clinical workspace</p>
        </div>
      </div>
    </div>
  );
}
