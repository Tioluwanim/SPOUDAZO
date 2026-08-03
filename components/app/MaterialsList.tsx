import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { prefetchMaterialDetail } from "@/lib/documentCache";
import type { Material } from "@/lib/types";

// Coarse phase → (label, progress%) - matches the real pipeline in
// spoudazo-api's materials.py (uploaded -> extracting -> embedding -> ready),
// not a simulation, since the backend genuinely reports these steps.
// Percentages are fixed checkpoints rather than time-based, since we don't
// know when a document entered its current phase from a poll response alone.
const PHASE: Record<string, { label: string; percent: number; eta?: string }> = {
  uploaded: { label: "Queued for processing…", percent: 8 },
  extracting: { label: "Extracting text…", percent: 30, eta: "~3–8s" },
  extracted: { label: "Text extracted — preparing to embed…", percent: 55 },
  embedding: { label: "Generating embeddings & building search index…", percent: 78, eta: "~15–40s" },
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

export function MaterialsList({ materials, courseId }: { materials: Material[]; courseId: number }) {
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
            {items.map((m) => {
              const phase = PHASE[m.status];
              const rowClass =
                "rounded-xl border border-ink-border bg-ink-surface/40 px-4 py-3 text-sm";
              const row = (
                <>
                  <div className="flex items-center gap-3">
                    <FileText size={15} className="shrink-0 text-paper-faint" />
                    <span className="flex-1 truncate text-paper-dim">{m.filename}</span>
                    {m.status === "ready" && (
                      <span className="font-mono text-xs text-paper-faint">{m.chunk_count} chunks</span>
                    )}
                    <Badge tone={m.status === "ready" ? "teal" : m.status === "failed" ? "clay" : "amber"}>
                      {m.status === "ready" ? "ready" : m.status === "failed" ? "failed" : "processing"}
                    </Badge>
                  </div>

                  {phase && (
                    <div className="mt-2.5 pl-[27px]">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-paper-faint">{phase.label}</span>
                        {phase.eta && <span className="text-paper-faint">{phase.eta}</span>}
                      </div>
                      <ProgressBar value={phase.percent} />
                    </div>
                  )}

                  {m.status === "failed" && (
                    <p className="mt-2 pl-[27px] text-xs text-danger">
                      Processing failed — try removing and re-uploading this file.
                    </p>
                  )}
                </>
              );

              return (
                <li key={m.doc_id}>
                  {m.status === "ready" ? (
                    <Link
                      href={`/courses/${courseId}/materials/${m.doc_id}`}
                      onMouseEnter={() => prefetchMaterialDetail(courseId, m.doc_id)}
                      className={`block transition-colors hover:border-ai-accent/40 ${rowClass}`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
