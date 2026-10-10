import Badge from "./Badge";
import { DOC_STATUS, REVIEW_STATUS, VISIT_STATUS, humanize } from "@/lib/status";

const maps = { visit: VISIT_STATUS, review: REVIEW_STATUS, document: DOC_STATUS };

export default function StatusBadge({ kind, status }: { kind: keyof typeof maps; status?: string | null }) {
  if (!status) return <Badge tone="neutral">Not submitted</Badge>;
  const meta = maps[kind][status] ?? { label: humanize(status), tone: "neutral" as const };
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
