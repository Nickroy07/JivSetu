import {
  ArrowRight,
  AudioLines,
  ClipboardCheck,
  FileSearch,
  FileText,
  GitCompareArrows,
  Languages,
  ListChecks,
  Lock,
  ScanText,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Logo from "@/components/ui/Logo";
import StatusBadge from "@/components/ui/StatusBadge";

const NAV = [
  { href: "#workflow", label: "Workflow" },
  { href: "#patients", label: "For patients" },
  { href: "#clinicians", label: "For clinicians" },
  { href: "#safety", label: "Privacy & safety" },
];

const STEPS = [
  { icon: UserRound, title: "Patient check-in", body: "Mobile verification and consent. Only a name and mobile number are collected." },
  { icon: AudioLines, title: "Guided interview", body: "One question at a time, by voice, touch or text in English, Hindi or Marathi." },
  { icon: ScanText, title: "Document reading", body: "Prescriptions and reports are read and key entries extracted with their source line." },
  { icon: ListChecks, title: "Draft history", body: "Answers and documents are organised into a structured draft with gaps and conflicts flagged." },
  { icon: ClipboardCheck, title: "Clinician review", body: "The doctor corrects, confirms and signs off. Nothing is final until they do." },
];

const CAPABILITIES = [
  { icon: Languages, title: "Multilingual by design", body: "Questions, answers and voice input in English, हिन्दी and मराठी." },
  { icon: FileSearch, title: "Source-referenced facts", body: "Every extracted medicine or lab value links back to the document line it came from." },
  { icon: GitCompareArrows, title: "Conflicts surfaced, not hidden", body: "If a patient says “no medicines” but a prescription lists one, both are shown side by side." },
  { icon: ListChecks, title: "Missing-information checks", body: "Unanswered or uncertain history items are listed so they can be asked in consultation." },
  { icon: Stethoscope, title: "Clinician-owned record", body: "Patient answers are never overwritten. Doctor corrections are stored separately with a timestamp." },
  { icon: ShieldCheck, title: "Screening flags", body: "Rule-based flags highlight reported findings that need prompt attention. They are not diagnoses." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Jivsetu AI home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LinkButton href="/doctor/login" variant="ghost" size="md" className="hidden sm:inline-flex">
              Clinician sign in
            </LinkButton>
            <LinkButton href="/patient" size="md">
              Start check-in
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#f5f9fc_0%,#ffffff_100%)]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div className="animate-rise">
              <Badge tone="brand" className="mb-5">Patient case-taking &amp; clinical documentation</Badge>
              <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
                From patient conversations to structured clinical histories.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Jivsetu guides patients through their history in their own language, reads the documents they bring,
                and prepares a source-referenced case summary for the clinician to review and confirm.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/patient" size="lg">
                  Start patient check-in <ArrowRight className="size-4" />
                </LinkButton>
                <LinkButton href="/doctor/login" size="lg" variant="outline">
                  Open clinician workspace
                </LinkButton>
              </div>
              <p className="mt-6 text-[13px] text-slate-500">
                Decision support for documentation only. Jivsetu does not diagnose and does not replace clinical judgement.
              </p>
            </div>

            <ProductPreview />
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 border-b border-slate-200">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading eyebrow="How it works" title="One workflow, from waiting room to reviewed case">
              Each step produces structured data the next step can use, and every step is visible to the clinician.
            </SectionHeading>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="bg-white p-5">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                    <span className="tnum flex size-6 items-center justify-center rounded-md bg-brand-50 text-xs">{i + 1}</span>
                    <s.icon className="size-4" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Patients / Clinicians */}
        <section className="border-b border-slate-200 bg-slate-50/60">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <AudienceCard
              id="patients"
              eyebrow="For patients"
              title="Simple enough for anyone to complete"
              points={[
                "Large touch targets, one question per screen",
                "Speak your answer, tap an option, or type",
                "Review and correct every answer before sending",
                "Photograph or upload prescriptions and reports",
                "Progress is kept if the connection drops",
              ]}
              cta={{ href: "/patient", label: "Start check-in" }}
            />
            <AudienceCard
              id="clinicians"
              eyebrow="For clinicians"
              title="A review workspace, not another form"
              points={[
                "Live queue with search, status filters and sorting",
                "Patient-reported facts kept separate from the generated draft",
                "Extracted medicines and labs with their source line",
                "Conflicts and missing information listed up front",
                "Edit, accept or return — every decision is timestamped",
              ]}
              cta={{ href: "/doctor/login", label: "Clinician sign in" }}
            />
          </div>
        </section>

        {/* Capabilities */}
        <section className="border-b border-slate-200">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading eyebrow="Capabilities" title="Built around how case-taking actually happens" />
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <div key={c.title}>
                  <c.icon className="size-5 text-brand-600" aria-hidden />
                  <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-20 bg-brand-900 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-brand-300">Privacy &amp; clinical safety</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">The clinician stays in charge of the record.</h2>
              <p className="mt-4 leading-relaxed text-brand-100/80">
                Jivsetu prepares information; it does not make clinical decisions. Generated content is always labelled
                as a draft and kept apart from what the patient said and what the doctor confirmed.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {[
                ["Not a diagnosis", "Summaries and screening flags are documentation aids that require clinician review."],
                ["Minimal data", "Patients provide only a name and mobile number to begin."],
                ["Access control", "Patients can see only their own record; clinical views require a staff sign-in."],
                ["Traceable", "Extracted facts carry a reference to the document they came from; reviews are audit-logged."],
              ].map(([t, b]) => (
                <li key={t} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <Lock className="size-4 text-brand-300" aria-hidden />
                  <p className="mt-3 font-medium">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-100/75">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-slate-500">People · Care · Connected</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600" aria-label="Footer">
            <Link href="/patient" className="hover:text-slate-900">Patient check-in</Link>
            <Link href="/doctor/login" className="hover:text-slate-900">Clinician sign in</Link>
            <a href="#safety" className="hover:text-slate-900">Privacy &amp; safety</a>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400 sm:px-6">
          © {new Date().getFullYear()} Jivsetu. For use under the supervision of qualified healthcare professionals.
        </p>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-medium uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {children && <p className="mt-3 leading-relaxed text-slate-600">{children}</p>}
    </div>
  );
}

function AudienceCard({
  id,
  eyebrow,
  title,
  points,
  cta,
}: {
  id: string;
  eyebrow: string;
  title: string;
  points: string[];
  cta: { href: string; label: string };
}) {
  return (
    <Card id={id} className="scroll-mt-20 p-7">
      <p className="text-[13px] font-medium uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[15px] text-slate-700">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf-500" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <LinkButton href={cta.href} variant="outline" className="mt-8">
        {cta.label} <ArrowRight className="size-4" />
      </LinkButton>
    </Card>
  );
}

/** Built from the same components the clinician workspace uses. Synthetic example. */
function ProductPreview() {
  return (
    <div className="relative animate-rise" aria-label="Illustrative product preview with synthetic data">
      <Card className="overflow-hidden shadow-(--shadow-pop)">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <span className="text-xs font-medium text-slate-500">Case review · Visit #1042</span>
          <Badge tone="neutral">Illustrative · synthetic data</Badge>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Sample Patient</p>
              <p className="text-[13px] text-slate-500">Chest pain · since this morning</p>
            </div>
            <StatusBadge kind="visit" status="ready_for_review" />
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft history</span>
              <Badge tone="violet">Auto-generated · needs review</Badge>
            </div>
            <dl className="divide-y divide-slate-100 text-[13px]">
              {[
                ["Severity", "Severe", "Patient"],
                ["Breathlessness", "Yes", "Patient"],
                ["Current medicines", "Metformin 500 mg BD", "Prescription p.1"],
              ].map(([k, v, s]) => (
                <div key={k} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-2 px-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{s}</span>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <GitCompareArrows className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              <strong className="font-medium">Conflict:</strong> patient reported no medicines; prescription lists Metformin.
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <FileText className="size-3.5" aria-hidden /> 2 documents · 1 missing item
            </span>
            <span className="rounded-md bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white">Review case</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
