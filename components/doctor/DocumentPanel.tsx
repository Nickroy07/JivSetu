"use client";

import { ExternalLink, FileText, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { api, errorMessage, openProtectedFile } from "@/lib/api";
import { DOC_TYPES, EXTRACTION_METHOD, formatBytes, formatDate } from "@/lib/status";
import type { DocumentItem, ExtractionData, LabValue, Medication } from "@/lib/types";

export default function DocumentPanel({
  doc,
  token,
  onChanged,
}: {
  doc: DocumentItem;
  token: string;
  onChanged: (doc?: DocumentItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"retry" | "open" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ext = doc.extraction;
  const data: ExtractionData | null = ext ? ext.reviewed_data ?? ext.data : null;

  async function retry() {
    setBusy("retry");
    setError(null);
    try {
      await api(`/documents/${doc.id}/retry`, { method: "POST", token });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function open() {
    setBusy("open");
    setError(null);
    try {
      await openProtectedFile(`/documents/${doc.id}/file`, token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200" id={`doc-${doc.id}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          <FileText className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {DOC_TYPES[doc.document_type] ?? doc.document_type}
            <span className="tnum ml-2 text-xs font-normal text-slate-400">#{doc.id}</span>
          </p>
          <p className="truncate text-xs text-slate-500">
            {doc.filename} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at, true)}
            {doc.extraction_method && ` · ${EXTRACTION_METHOD[doc.extraction_method] ?? doc.extraction_method}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc.processing ? (
            <Badge tone="info"><Spinner className="size-3" /> Reading</Badge>
          ) : (
            <StatusBadge kind="document" status={doc.upload_status} />
          )}
          <Button variant="ghost" size="sm" onClick={open} loading={busy === "open"} aria-label="Open original file">
            <ExternalLink className="size-3.5" /> Original
          </Button>
          {doc.can_retry && (
            <Button variant="outline" size="sm" onClick={retry} loading={busy === "retry"}>
              <RotateCw className="size-3.5" /> Retry
            </Button>
          )}
          {ext && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Correct
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        {error && <Alert tone="danger">{error}</Alert>}
        {doc.processing_error && (
          <Alert tone={doc.upload_status === "failed" ? "danger" : "warning"}>{doc.processing_error}</Alert>
        )}

        {ext && !editing && data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ext.reviewed_data ? (
                <Badge tone="success">Corrected by {ext.reviewed_by} · {formatDate(ext.reviewed_at, true)}</Badge>
              ) : (
                <Badge tone="violet">Machine-extracted · verify against original</Badge>
              )}
              <span className="text-slate-500" title="Share of expected fields found in the text. Not a measure of accuracy.">
                Field coverage {Math.round(ext.coverage)}% (heuristic)
              </span>
            </div>
            <ExtractionView data={data} />
          </>
        )}

        {ext && editing && data && (
          <ExtractionEditor
            initial={data}
            onCancel={() => setEditing(false)}
            onSave={async (reviewed) => {
              const res = await api<{ document: DocumentItem }>(`/documents/${doc.id}/extraction/review`, {
                method: "PUT",
                token,
                json: { reviewed_data: reviewed },
              });
              setEditing(false);
              onChanged(res.document);
            }}
          />
        )}

        {doc.ocr_text && (
          <details className="group text-sm">
            <summary className="cursor-pointer select-none text-[13px] font-medium text-slate-600 hover:text-slate-900">
              Show text read from document
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
              {doc.ocr_text}
            </pre>
          </details>
        )}
      </div>
    </article>
  );
}

function ExtractionView({ data }: { data: ExtractionData }) {
  const meta = [
    ["Document date", data.document_date],
    ["Doctor", data.doctor_name],
    ["Facility", data.hospital_name],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-3 text-sm">
      {meta.length > 0 && (
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {!!data.diagnoses_mentioned?.length && <Chips label="Diagnoses mentioned in document" items={data.diagnoses_mentioned} />}
      {!!data.allergies_mentioned?.length && <Chips label="Allergies mentioned" items={data.allergies_mentioned} />}
      {!!data.medications?.length && (
        <MiniTable
          label="Medicines"
          head={["Name", "Strength", "Frequency", "Source line"]}
          rows={data.medications.map((m) => [m.name, m.strength, m.frequency, m.source_text])}
        />
      )}
      {!!data.lab_values?.length && (
        <MiniTable
          label="Tests & values"
          head={["Test", "Value", "Unit", "Source line"]}
          rows={data.lab_values.map((l) => [l.test_name, l.value, l.unit, l.source_text])}
        />
      )}
      {!data.medications?.length && !data.lab_values?.length && !data.diagnoses_mentioned?.length && (
        <p className="text-[13px] text-slate-500">No medicines, tests or diagnoses were identified in this document.</p>
      )}
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((d) => (
          <span key={d} className="rounded-md bg-slate-100 px-2 py-0.5 text-[13px] text-slate-800">{d}</span>
        ))}
      </div>
    </div>
  );
}

function MiniTable({ label, head, rows }: { label: string; head: string[]; rows: (string | null | undefined)[][] }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{head.map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={j === r.length - 1 ? "px-3 py-1.5 font-mono text-[11px] text-slate-500" : "px-3 py-1.5 text-slate-800"}>
                    {c || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExtractionEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ExtractionData;
  onSave: (data: ExtractionData) => Promise<void>;
  onCancel: () => void;
}) {
  const [meds, setMeds] = useState<Medication[]>(initial.medications ?? []);
  const [labs, setLabs] = useState<LabValue[]>(initial.lab_values ?? []);
  const [diagnoses, setDiagnoses] = useState((initial.diagnoses_mentioned ?? []).join(", "));
  const [allergies, setAllergies] = useState((initial.allergies_mentioned ?? []).join(", "));
  const [date, setDate] = useState(initial.document_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...initial,
        document_date: date || null,
        diagnoses_mentioned: split(diagnoses),
        allergies_mentioned: split(allergies),
        medications: meds.filter((m) => m.name.trim()),
        lab_values: labs.filter((l) => l.test_name.trim()),
      });
    } catch (err) {
      // Keep the editor open with the clinician's input intact.
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md bg-slate-50 p-3">
      {error && <Alert tone="danger" title="Corrections not saved">{error} Your edits are still here.</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-600">Document date<Input className="mt-1 h-8 text-sm" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs text-slate-600 sm:col-span-2">Diagnoses (comma separated)<Input className="mt-1 h-8 text-sm" value={diagnoses} onChange={(e) => setDiagnoses(e.target.value)} /></label>
        <label className="text-xs text-slate-600 sm:col-span-3">Allergies (comma separated)<Input className="mt-1 h-8 text-sm" value={allergies} onChange={(e) => setAllergies(e.target.value)} /></label>
      </div>

      <RowsEditor
        label="Medicines"
        rows={meds}
        cols={[["name", "Name"], ["strength", "Strength"], ["frequency", "Frequency"]]}
        onChange={setMeds}
        blank={{ name: "", strength: "", frequency: "" }}
      />
      <RowsEditor
        label="Tests & values"
        rows={labs}
        cols={[["test_name", "Test"], ["value", "Value"], ["unit", "Unit"]]}
        onChange={setLabs}
        blank={{ test_name: "", value: "", unit: "" }}
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={save} loading={saving}>Save corrections</Button>
      </div>
    </div>
  );
}

function RowsEditor<T extends object>({
  label,
  rows,
  cols,
  onChange,
  blank,
}: {
  label: string;
  rows: T[];
  cols: [keyof T & string, string][];
  onChange: (rows: T[]) => void;
  blank: T;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <Button variant="ghost" size="sm" onClick={() => onChange([...rows, { ...blank }])}><Plus className="size-3.5" /> Add</Button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {cols.map(([key, ph]) => (
              <Input
                key={key}
                placeholder={ph}
                aria-label={`${label} ${i + 1} ${ph}`}
                className="h-8 text-sm"
                value={String((row as Record<string, unknown>)[key] ?? "")}
                onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))}
              />
            ))}
            <Button variant="ghost" size="sm" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-slate-400">None</p>}
      </div>
    </div>
  );
}
