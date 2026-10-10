"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import Logo from "@/components/ui/Logo";
import type { Language } from "@/lib/i18n";
import { CopyKey, t } from "@/lib/patientCopy";
import { cn } from "@/lib/utils";

const LANG_KEY = "jivsetu.lang";
const LANGS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
];

interface LangCtx {
  lang: Language;
  setLang: (l: Language) => void;
  tr: (key: CopyKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LangCtx>({ lang: "en", setLang: () => {}, tr: (k) => t("en", k) });
export const usePatientLang = () => useContext(LanguageContext);

const STEPS: CopyKey[] = ["steps_verify", "steps_consent", "steps_interview", "steps_documents", "steps_review"];

export default function PatientShell({ step, children, wide }: { step?: number; children: ReactNode; wide?: boolean }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(LANG_KEY) as Language | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved language once
      if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      sessionStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const ctx: LangCtx = { lang, setLang, tr: (k, v) => t(lang, k, v) };

  return (
    <LanguageContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
            <Link href="/" aria-label="Jivsetu home">
              <Logo />
            </Link>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Language">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  aria-pressed={lang === l.code}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                    lang === l.code ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          {step !== undefined && (
            <nav aria-label="Progress" className="mx-auto max-w-3xl px-4 pb-3">
              <ol className="flex items-center gap-1.5">
                {STEPS.map((s, i) => {
                  const done = i < step;
                  const current = i === step;
                  return (
                    <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
                      <span className={cn("h-1 rounded-full transition-colors", done ? "bg-leaf-500" : current ? "bg-brand-600" : "bg-slate-200")} />
                      <span className={cn("hidden items-center gap-1 text-xs sm:flex", current ? "font-medium text-slate-900" : "text-slate-500")}>
                        {done && <Check className="size-3 text-leaf-600" aria-hidden />}
                        {ctx.tr(s)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </header>
        <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:py-12", wide ? "max-w-3xl" : "max-w-xl")}>{children}</main>
      </div>
    </LanguageContext.Provider>
  );
}

export function PatientHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
      {body && <p className="mt-2 text-[17px] leading-relaxed text-slate-600">{body}</p>}
    </div>
  );
}
