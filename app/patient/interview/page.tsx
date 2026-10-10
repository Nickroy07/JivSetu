"use client";

import { ArrowLeft, ArrowRight, Check, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import VoiceInput from "@/components/patient/VoiceInput";
import PatientShell, { usePatientLang } from "@/components/patient/PatientShell";
import { usePatientSession } from "@/components/patient/usePatientSession";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Answers, visibleQuestions } from "@/lib/interview";
import { loadDraft, saveDraft } from "@/lib/session";
import { cn } from "@/lib/utils";

export default function InterviewPage() {
  return (
    <PatientShell step={2}>
      <Interview />
    </PatientShell>
  );
}

function Interview() {
  const { lang, tr } = usePatientLang();
  const router = useRouter();
  const session = usePatientSession();
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const key = session ? `answers.${session.visitId}` : null;

  useEffect(() => {
    if (!key) return;
    const d = loadDraft<{ answers: Answers; index: number }>(key);
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore interview draft once
      setAnswers(d.answers);
      setIndex(d.index);
    }
    setLoaded(true);
  }, [key]);

  const questions = useMemo(() => visibleQuestions(answers), [answers]);
  const safeIndex = Math.min(index, questions.length - 1);
  const q = questions[safeIndex];

  const [speaking, setSpeaking] = useState(false);

  // Stop speaking if question changes
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [q?.id]);

  function toggleSpeech(textToSpeak: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (key && loaded) saveDraft(key, { answers, index: safeIndex });
  }, [key, loaded, answers, safeIndex]);

  // Sync text box with the stored answer when the question changes.
  useEffect(() => {
    if (q && (q.inputType === "text" || q.inputType === "number")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load stored answer into editor
      setText(answers[q.id] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  if (!session || !loaded || !q) return null;

  const isLast = safeIndex === questions.length - 1;
  const current = answers[q.id];

  function go(delta: number, nextAnswers = answers) {
    const list = visibleQuestions(nextAnswers);
    const i = safeIndex + delta;
    if (i < 0) return router.push("/patient/consent");
    if (i >= list.length) return router.push("/patient/documents");
    setIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function choose(value: string) {
    const next = { ...answers, [q.id]: value };
    // Changing the complaint changes which follow-up questions apply.
    if (q.id === "chief_complaint") {
      const allowed = new Set(visibleQuestions(next).map((x) => x.id));
      Object.keys(next).forEach((k) => !allowed.has(k) && delete next[k]);
    }
    setAnswers(next);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(1, next), 280);
  }

  function commitText() {
    const v = text.trim();
    const next = { ...answers };
    if (v) next[q.id] = v;
    else delete next[q.id];
    setAnswers(next);
    go(1, next);
  }

  const options: { id: string; label: string }[] =
    q.inputType === "yesNo"
      ? [
          { id: "yes", label: tr("yes") },
          { id: "no", label: tr("no") },
          { id: "unknown", label: tr("not_sure") },
        ]
      : (q.options ?? []).map((o) => ({ id: o.id, label: o.label[lang] ?? o.label.en }));

  const isText = q.inputType === "text" || q.inputType === "number";
  const canNext = isText ? !q.required || text.trim().length > 0 : !!current;

  return (
    <div key={q.id} className="animate-rise">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span className="tnum">{tr("question_of", { n: safeIndex + 1, total: questions.length })}</span>
        <span>{q.section}</span>
      </div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${((safeIndex + 1) / questions.length) * 100}%` }} />
      </div>

            <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-[28px]">
          {q.question[lang] ?? q.question.en}
        </h1>
        <button
          type="button"
          onClick={() => toggleSpeech((q.question[lang] ?? q.question.en) + (q.helpText ? '. ' + (q.helpText[lang] ?? q.helpText.en) : ''))}
          className={cn(
            "mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors",
            speaking ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
          aria-label={speaking ? "Stop read-aloud" : "Read question aloud"}
          title={speaking ? "Stop" : "Read aloud"}
        >
          {speaking ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>
      {q.helpText && <p className="mt-2 text-[17px] text-slate-600">{q.helpText[lang] ?? q.helpText.en}</p>}

      <div className="mt-8">
        {isText ? (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tr("type_answer")}
              rows={4}
              maxLength={2000}
              inputMode={q.inputType === "number" ? "numeric" : undefined}
              aria-label={q.question[lang] ?? q.question.en}
              className="text-lg"
            />
            <VoiceInput
              language={lang}
              onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))}
            />
            <p className="text-sm text-slate-500">{tr("speak_or_type")}</p>
          </div>
        ) : (
          <div className="grid gap-3" role="radiogroup" aria-label={q.question[lang] ?? q.question.en}>
            {options.map((o) => {
              const selected = current === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(o.id)}
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-3 rounded-lg border-2 px-5 py-3 text-left text-lg font-medium transition-colors",
                    selected ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  )}
                >
                  {o.label}
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>
                    {selected && <Check className="size-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Button variant="outline" size="xl" onClick={() => go(-1)} aria-label={tr("back")}>
          <ArrowLeft className="size-5" />
        </Button>
        {isText ? (
          <Button size="xl" className="flex-1" onClick={commitText} disabled={!canNext}>
            {isLast ? tr("continue") : tr("next")} <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button size="xl" className="flex-1" onClick={() => go(1)} disabled={!canNext}>
            {isLast ? tr("continue") : tr("next")} <ArrowRight className="size-5" />
          </Button>
        )}
      </div>
      {!q.required && (
        <button onClick={() => { const n = { ...answers }; delete n[q.id]; setAnswers(n); go(1, n); }} className="mt-4 w-full text-center text-sm text-slate-500 underline-offset-4 hover:underline">
          {tr("skip")}
        </button>
      )}
      <p className="mt-8 text-center text-xs text-slate-400">{tr("saved_locally")}</p>
    </div>
  );
}
