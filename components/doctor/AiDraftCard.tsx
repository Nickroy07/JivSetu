"use client";

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import { api, errorMessage } from "@/lib/api";

interface AiDraftResponse {
  status: "unapproved_draft";
  model: string;
  disclaimer: string;
  draft: {
    summary: string;
    patient_reported: string[];
    from_documents: string[];
    unclear_or_missing: string[];
  };
}

/**
 * Optional AI-organised draft. Only runs when the clinician clicks the button;
 * the result is shown on screen as an unapproved draft and is not stored.
 */
export default function AiDraftCard({ visitId, token }: { visitId: string; token: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiDraftResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ enabled: boolean }>("/clinical-history/ai-status", { token })
      .then((r) => !cancelled && setEnabled(r.enabled))
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api<AiDraftResponse>(`/clinical-history/visits/${visitId}/ai-draft`, { method: "POST", token }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const lists: [string, string[]][] = result
    ? [
        ["Patient reported", result.draft.patient_reported],
        ["From documents", result.draft.from_documents],
        ["Unclear or missing", result.draft.unclear_or_missing],
      ]
    : [];

  return (
    <Card>
      <CardHeader
        title="AI-organised summary (optional)"
        description="Organises the data above into a short draft. It can be wrong; verify against the sources."
        icon={<Bot className="size-4 text-violet-600" />}
        actions={
          <Button size="sm" variant="outline" onClick={generate} loading={loading} disabled={!enabled || loading}>
            {result ? "Regenerate" : "Generate AI summary"}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {enabled === false && (
          <p className="text-sm text-slate-500">
            Not available: AI drafting is not configured on this server (the administrator must set the OpenRouter key and model).
          </p>
        )}
        {enabled && !result && !error && (
          <p className="text-sm text-slate-500">
            Clicking the button sends the patient’s answers and extracted document facts (no name or phone number) to an external AI service.
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">Unapproved AI draft</Badge>
              <span className="text-xs text-slate-500">Model: {result.model}</span>
            </div>
            <p className="text-[15px] leading-relaxed text-slate-800">{result.draft.summary}</p>
            {lists.map(([label, items]) =>
              items.length ? (
                <div key={label}>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-800">
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
            <p className="text-xs text-slate-500">{result.disclaimer}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
