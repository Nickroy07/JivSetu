"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import Spinner from "@/components/ui/Spinner";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AyushLang = "en" | "hi" | "mr";
type L10n = Record<AyushLang, string>;
interface FieldDef { key: string; audience: "patient" | "practitioner"; label: L10n; suggestions?: string[] }
interface ModuleDef { title: L10n; instructions: L10n; fields: FieldDef[] }
interface Assessment {
  module: string;
  values: Record<string, string>;
  sources: Record<string, string>;
  status: "completed" | "incomplete";
  review_status: "reviewed" | "unreviewed";
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const COPY: Record<AyushLang, Record<string, string>> = {
  en: { save: "Save", saved: "Saved.", verify: "Save and verify", completed: "Completed", incomplete: "Incomplete", reviewed: "Verified", unreviewed: "Not verified", patient: "Patient", practitioner: "Practitioner", note: "Documentation only. No score or diagnosis is generated.", by: "by" },
  hi: { save: "सहेजें", saved: "सहेजा गया।", verify: "सहेजें और सत्यापित करें", completed: "पूर्ण", incomplete: "अपूर्ण", reviewed: "सत्यापित", unreviewed: "सत्यापित नहीं", patient: "रोगी", practitioner: "चिकित्सक", note: "केवल दस्तावेज़ीकरण। कोई स्कोर या निदान नहीं बनाया जाता।", by: "द्वारा" },
  mr: { save: "जतन करा", saved: "जतन केले.", verify: "जतन करा आणि सत्यापित करा", completed: "पूर्ण", incomplete: "अपूर्ण", reviewed: "सत्यापित", unreviewed: "सत्यापित नाही", patient: "रुग्ण", practitioner: "वैद्य", note: "फक्त नोंद. कोणताही स्कोअर किंवा निदान तयार केले जात नाही.", by: "द्वारे" },
};

export default function AssessmentForm({
  visitId,
  token,
  lang,
  canVerify = false,
}: {
  visitId: number | string;
  token: string;
  lang: AyushLang;
  canVerify?: boolean;
}) {
  const t = COPY[lang];
  const [schema, setSchema] = useState<Record<string, ModuleDef> | null>(null);
  const [items, setItems] = useState<Record<string, Assessment>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [active, setActive] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api<{ modules: Record<string, ModuleDef> }>("/ayush/schema", { token }),
        api<{ modules: Assessment[] }>(`/ayush/visits/${visitId}`, { token }),
      ]);
      setSchema(s.modules);
      setItems(Object.fromEntries(a.modules.map((m) => [m.module, m])));
      setActive((cur) => cur || Object.keys(s.modules)[0] || "");
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [token, visitId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch from the API
    load();
  }, [load]);

  if (loadError) return <Alert tone="danger">{loadError}</Alert>;
  if (!schema || !active) return <Spinner label="Loading" />;

  const mod = schema[active];
  const item = items[active];
  const value = (k: string) => drafts[active]?.[k] ?? item?.values[k] ?? "";
  const dirty = Object.keys(drafts[active] ?? {}).length > 0;

  async function save(verify: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ assessment: Assessment }>(`/ayush/visits/${visitId}/${active}`, {
        method: "PUT",
        token,
        json: { values: drafts[active] ?? {}, verify },
      });
      setItems((cur) => ({ ...cur, [active]: res.assessment }));
      setDrafts((cur) => ({ ...cur, [active]: {} }));
      setMessage({ tone: "success", text: t.saved });
    } catch (err) {
      // Typed answers stay in the form so nothing is lost.
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {Object.entries(schema).map(([name, m]) => (
          <button
            key={name}
            role="tab"
            aria-selected={active === name}
            onClick={() => { setActive(name); setMessage(null); }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
              active === name ? "border-brand-600 text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            {m.title[lang]}
            {items[name]?.review_status === "reviewed" ? <ShieldCheck className="size-4 text-leaf-600" aria-label={t.reviewed} /> : items[name]?.status === "completed" ? <CheckCircle2 className="size-4 text-slate-400" aria-label={t.completed} /> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={item?.status === "completed" ? "success" : "warning"} dot>{item?.status === "completed" ? t.completed : t.incomplete}</Badge>
        {canVerify && (
          <Badge tone={item?.review_status === "reviewed" ? "success" : "neutral"}>
            {item?.review_status === "reviewed" ? `${t.reviewed} ${t.by} ${item.reviewed_by}` : t.unreviewed}
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600">{mod.instructions[lang]}</p>

      <div className="mt-4 space-y-4">
        {mod.fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`ayush-${f.key}`} className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
              {f.label[lang]}
              {canVerify && <Badge tone={f.audience === "patient" ? "info" : "violet"}>{t[f.audience]}</Badge>}
              {canVerify && item?.sources[f.key] && <span className="text-xs font-normal text-slate-500">({t[item.sources[f.key]]})</span>}
            </label>
            <Textarea
              id={`ayush-${f.key}`}
              rows={2}
              maxLength={1000}
              className="mt-1.5"
              value={value(f.key)}
              onChange={(e) => setDrafts((cur) => ({ ...cur, [active]: { ...cur[active], [f.key]: e.target.value } }))}
            />
            {f.suggestions && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {f.suggestions.map((s) => (
                  <button key={s} type="button" className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                    onClick={() => setDrafts((cur) => ({ ...cur, [active]: { ...cur[active], [f.key]: s } }))}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {message && <Alert tone={message.tone} className="mt-4">{message.text}</Alert>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => save(false)} loading={busy} disabled={!dirty || busy} size={canVerify ? "md" : "lg"}>{t.save}</Button>
        {canVerify && <Button variant="outline" onClick={() => save(true)} disabled={busy}>{t.verify}</Button>}
      </div>
      <p className="mt-3 text-xs text-slate-500">{t.note}</p>
    </div>
  );
}
