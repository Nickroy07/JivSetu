import type { Tone } from "@/components/ui/Badge";

export const VISIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  waiting: { label: "Checked in", tone: "neutral" },
  in_interview: { label: "In interview", tone: "info" },
  documents_uploaded: { label: "Documents added", tone: "violet" },
  ready_for_review: { label: "Ready for review", tone: "warning" },
  completed: { label: "Reviewed", tone: "success" },
};

export const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting review", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  amended: { label: "Accepted with edits", tone: "success" },
  rejected: { label: "Returned", tone: "danger" },
};

export const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  uploaded: { label: "Queued", tone: "neutral" },
  processing: { label: "Reading", tone: "info" },
  processed: { label: "Processed", tone: "success" },
  failed: { label: "Needs attention", tone: "danger" },
};

export const DOC_TYPES: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab report",
  discharge_summary: "Discharge summary",
  xray_report: "X-ray report",
  mri_report: "MRI report",
  ct_report: "CT report",
  handwritten_note: "Handwritten note",
  other: "Other",
};

export const EXTRACTION_METHOD: Record<string, string> = {
  pdf_text: "PDF text layer",
  paddleocr: "PaddleOCR",
  tesseract: "Tesseract OCR",
};

export function humanize(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  return s.includes(" ") ? s : s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return "—";
  // Backend timestamps are naive UTC.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) || iso.length <= 10 ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(/[zZ]$/.test(iso) ? iso : `${iso}Z`);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (Number.isNaN(s)) return "—";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return formatDate(iso);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
