"use client";

import { useState } from "react";
import { Plus, StickyNote as StickyNoteIcon, Trash2, X as XIcon } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { createAnnotation, deleteAnnotation } from "@/lib/api";
import type { Annotation } from "@/lib/types";

/**
 * Unlike a highlight or bookmark (both anchored to a specific selected
 * phrase), a sticky note attaches to a section as a whole - "+ Add sticky
 * note" appears at the end of every section rather than requiring the
 * student to select text first, since a margin note is often about the
 * section's idea in general, not one exact sentence.
 */
export function StickyNotes({
  courseId,
  docId,
  sectionIndex,
  sectionTitle,
  notes,
  onChanged,
}: {
  courseId: number;
  docId: string;
  sectionIndex: number;
  sectionTitle: string;
  notes: Annotation[];
  onChanged: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await createAnnotation(courseId, docId, "sticky_note", sectionIndex, sectionTitle || "Note", draft.trim());
      setDraft("");
      setComposing(false);
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save the note", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAnnotation(courseId, docId, id);
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't remove the note", "error");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {notes.map((n) => (
        <div
          key={n.id}
          className="group relative rounded-lg border border-achievement/30 bg-achievement/10 px-3 py-2.5"
        >
          <div className="flex items-start gap-2">
            <StickyNoteIcon size={13} className="mt-0.5 shrink-0 text-achievement" />
            <p className="text-xs leading-relaxed text-paper-dim">{n.note}</p>
            <button
              onClick={() => handleDelete(n.id)}
              className="ml-auto shrink-0 text-paper-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-ring"
              aria-label="Delete note"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {composing ? (
        <div className="rounded-lg border border-achievement/30 bg-achievement/5 p-2.5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Note to yourself about this section…"
            rows={2}
            className="w-full resize-none rounded-md border border-ink-border bg-ink px-2 py-1.5 text-xs text-paper placeholder:text-paper-faint focus-ring"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
              className="rounded-md px-2 py-1 text-xs text-paper-faint hover:text-paper focus-ring"
            >
              <XIcon size={12} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="rounded-md bg-achievement px-2.5 py-1 text-xs font-medium text-ink hover:opacity-90 focus-ring disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 text-xs text-paper-faint transition-colors hover:text-achievement focus-ring"
        >
          <Plus size={12} /> Add sticky note
        </button>
      )}
    </div>
  );
}
