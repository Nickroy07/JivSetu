"use client";

import { useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/status";
import type { ConflictDecision, ConflictResolutionRecord } from "@/lib/types";

const DECISIONS: Record<ConflictDecision, string> = {
  patient_correct: "Patient’s answer is correct",
  document_correct: "Document is correct",
  needs_follow_up: "Needs follow-up with the patient",
};

/**
 * Records a clinician decision on one conflict. A written reason is required.
 * The patient's answer and the document data are never changed; the decision is stored separately.
 */
export default function ConflictResolver({
  visitId,
  field,
  token,
  resolution,
  onSaved,
}: {
  visitId: string;
  field: string;
  token: string;
  resolution: ConflictResolutionRecord | null;
  onSaved: (all: Record<string, ConflictResolutionRecord>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<ConflictDecision>("needs_follow_up");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    if (reason.trim().length < 5) {
      setError("Write a short reason (at least 5 characters) for this decision.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ conflict_resolutions: Record<string, ConflictResolutionRecord> }>(
        `/clinical-history/visits/${visitId}/conflicts/${encodeURIComponent(field)}/resolve`,
        { method: "POST", token, json: { decision, reason: reason.trim() } }
      );
      onSaved(res.conflict_resolutions);
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 pt-1">
      {resolution && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={resolution.decision === "needs_follow_up" ? "warning" : "success"}>{DECISIONS[resolution.decision]}</Badge>
            <span className="text-xs text-slate-500">
              {resolution.resolved_by}
              {resolution.resolved_at ? ` · ${formatDate(resolution.resolved_at)}` : ""}
            </span>
          </div>
          <p className="mt-1 text-slate-800">Reason: {resolution.reason}</p>
        </div>
      )}
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {resolution ? "Change decision" : "Record decision"}
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <Field label="Decision">
            {(p) => (
              <Select {...p} value={decision} onChange={(e) => setDecision(e.target.value as ConflictDecision)}>
                {Object.entries(DECISIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reason (required)">
            {(p) => (
              <Textarea {...p} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={saving} disabled={saving}>
              Save decision
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
