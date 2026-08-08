"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { prefetchMaterialDetail } from "@/lib/documentCache";
import { deleteMaterial } from "@/lib/api";

import type { Material } from "@/lib/types";

// -----------------------------------------------------------------------------
// Processing phases
// -----------------------------------------------------------------------------
// These correspond to the real processing pipeline in spoudazo-api:
// uploaded -> extracting -> extracted -> embedding -> ready.
//
// Percentages are fixed checkpoints because we don't know exactly how long
// each backend phase will take from polling responses alone.
// -----------------------------------------------------------------------------

const PHASE: Record<
  string,
  {
    label: string;
    percent: number;
    eta?: string;
  }
> = {
  uploaded: {
    label: "Queued for processing…",
    percent: 8,
  },

  extracting: {
    label: "Extracting text…",
    percent: 30,
    eta: "~3–8s",
  },

  extracted: {
    label: "Text extracted — preparing to embed…",
    percent: 55,
  },

  embedding: {
    label: "Generating embeddings & building search index…",
    percent: 78,
    eta: "~15–40s",
  },
};

// -----------------------------------------------------------------------------
// Group materials by week
// -----------------------------------------------------------------------------

function groupByWeek(
  materials: Material[]
): [string, Material[]][] {
  const groups = new Map<string, Material[]>();

  for (const material of materials) {
    const key =
      material.week_number != null
        ? `Week ${material.week_number}`
        : "General";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(material);
  }

  // Numbered weeks first, in ascending order.
  // "General" always appears last.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "General") return 1;
    if (b === "General") return -1;

    return (
      Number(a.replace("Week ", "")) -
      Number(b.replace("Week ", ""))
    );
  });
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

type MaterialsListProps = {
  materials: Material[];
  courseId: number;

  /**
   * Called after a material has been successfully deleted.
   * The parent component uses this to remove the material from local state.
   *
   * Material.doc_id is a string, so the callback must also receive a string.
   */
  onDeleted?: (docId: string) => void;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MaterialsList({
  materials,
  courseId,
  onDeleted,
}: MaterialsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (materials.length === 0) {
    return null;
  }

  const groups = groupByWeek(materials);

  // ---------------------------------------------------------------------------
  // Delete material
  // ---------------------------------------------------------------------------

  async function handleDelete(
    event: React.MouseEvent<HTMLButtonElement>,
    docId: string
  ) {
    // Prevent the button from triggering the Link when a ready material
    // is wrapped inside a Link.
    event.preventDefault();
    event.stopPropagation();

    // Prevent multiple delete requests at the same time.
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this material? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(docId);

      // Delete from the backend first.
      await deleteMaterial(docId);

      // Tell the parent component to remove the material from local state.
      onDeleted?.(docId);
    } catch (error) {
      console.error("Failed to delete material:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Failed to delete material. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {groups.map(([weekLabel, items]) => (
        <div key={weekLabel}>
          {/* Week heading */}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper-faint">
            {weekLabel}
          </h3>

          <ul className="space-y-2">
            {items.map((m) => {
              const phase = PHASE[m.status];

              const rowClass =
                "rounded-xl border border-ink-border bg-ink-surface/40 px-4 py-3 text-sm";

              const row = (
                <div className="flex items-start gap-3">
                  {/* File icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-surface text-paper-faint">
                    <FileText size={16} />
                  </div>

                  {/* Material information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-paper">
                          {m.filename}
                        </p>

                        {m.status === "ready" && (
                          <p className="mt-0.5 text-xs text-paper-faint">
                            {m.chunk_count} chunks
                          </p>
                        )}
                      </div>

                      {/* Status + delete */}
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          tone={
                            m.status === "ready"
                              ? "teal"
                              : m.status === "failed"
                                ? "clay"
                                : "amber"
                          }
                        >
                          {m.status === "ready"
                            ? "ready"
                            : m.status === "failed"
                              ? "failed"
                              : "processing"}
                        </Badge>

                        <button
                          type="button"
                          onClick={(event) =>
                            handleDelete(event, m.doc_id)
                          }
                          disabled={deletingId === m.doc_id}
                          aria-label={`Delete ${m.filename}`}
                          title="Delete material"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-paper-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === m.doc_id ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Processing progress */}
                    {phase && (
                      <div className="mt-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-paper-faint">
                            {phase.label}
                          </span>

                          {phase.eta && (
                            <span className="text-paper-faint">
                              {phase.eta}
                            </span>
                          )}
                        </div>

                        <ProgressBar value={phase.percent} />
                      </div>
                    )}

                    {/* Failed state */}
                    {m.status === "failed" && (
                      <p className="mt-2 text-xs text-danger">
                        Processing failed — try removing and
                        re-uploading this file.
                      </p>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={m.doc_id}>
                  {m.status === "ready" ? (
                    <Link
                      href={`/courses/${courseId}/materials/${m.doc_id}`}
                      onMouseEnter={() =>
                        prefetchMaterialDetail(
                          courseId,
                          m.doc_id
                        )
                      }
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
