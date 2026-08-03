"use client";

import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { deleteAnnotation } from "@/lib/api";
import type { Annotation } from "@/lib/types";

/**
 * Shared rendering for ReaderBookmarks and ReaderHighlights - both are
 * "a list of this annotation kind for this document, click to jump,
 * delete on hover", differing only in kind, empty-state copy, and accent
 * color. Kept as one implementation so the two stay visually and
 * behaviorally consistent instead of drifting apart.
 */
export function AnnotationList({
  courseId,
  docId,
  items,
  emptyLabel,
  accentClass,
  onJump,
  onChanged,
}: {
  courseId: number;
  docId: string;
  items: Annotation[];
  emptyLabel: string;
  accentClass: string;
  onJump: (sectionIndex: number) => void;
  onChanged: () => void;
}) {
  const { push } = useToast();

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteAnnotation(courseId, docId, id);
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't remove that", "error");
    }
  }

  if (items.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-paper-faint">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1 px-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onJump(item.section_index)}
            className="group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink-border focus-ring"
          >
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${accentClass}`} />
            <span className="min-w-0 flex-1">
              <p className="truncate text-xs text-paper-dim">&ldquo;{item.quote}&rdquo;</p>
              {item.note && <p className="mt-0.5 truncate text-[11px] text-paper-faint">{item.note}</p>}
            </span>
            <span
              role="button"
              onClick={(e) => handleDelete(item.id, e)}
              className="shrink-0 text-paper-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-ring"
              aria-label="Delete"
            >
              <Trash2 size={12} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
