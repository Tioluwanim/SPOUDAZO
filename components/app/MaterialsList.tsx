import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Material } from "@/lib/types";

const STATUS_TONE: Record<string, "amber" | "teal" | "clay" | "neutral"> = {
  uploaded: "amber",
  extracting: "amber",
  extracted: "amber",
  embedding: "amber",
  ready: "teal",
  failed: "clay",
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: "queued",
  extracting: "extracting text",
  extracted: "extracted",
  embedding: "embedding",
  ready: "ready",
  failed: "failed",
};

function groupByWeek(materials: Material[]): [string, Material[]][] {
  const groups = new Map<string, Material[]>();
  for (const m of materials) {
    const key = m.week_number != null ? `Week ${m.week_number}` : "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  // Numbered weeks first, in order; "General" last.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "General") return 1;
    if (b === "General") return -1;
    return Number(a.replace("Week ", "")) - Number(b.replace("Week ", ""));
  });
}

export function MaterialsList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return null;
  const groups = groupByWeek(materials);

  return (
    <div className="space-y-5">
      {groups.map(([weekLabel, items]) => (
        <div key={weekLabel}>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">
            {weekLabel}
          </p>
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.doc_id}
                className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface/40 px-4 py-3 text-sm"
              >
                <FileText size={15} className="shrink-0 text-paper-faint" />
                <span className="flex-1 truncate text-paper-dim">{m.filename}</span>
                <span className="font-mono text-xs text-paper-faint">{m.chunk_count} chunks</span>
                <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
