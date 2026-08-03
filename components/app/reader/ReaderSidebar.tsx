"use client";

import { useState } from "react";
import { FileText, List, Bookmark, Highlighter } from "lucide-react";
import { TableOfContents } from "@/components/reader/TableOfContents";
import { ReaderBookmarks } from "@/components/reader/ReaderBookmarks";
import { ReaderHighlights } from "@/components/reader/ReaderHighlights";
import type { Annotation, DocumentSection, Material } from "@/lib/types";

type Tab = "materials" | "contents" | "bookmarks" | "highlights";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "materials", label: "Materials", icon: FileText },
  { id: "contents", label: "Contents", icon: List },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "highlights", label: "Highlights", icon: Highlighter },
];

export function ReaderSidebar({
  courseId,
  docId,
  materials,
  sections,
  activeSectionIndex,
  bookmarks,
  highlights,
  onSelectMaterial,
  onSelectSection,
  onAnnotationsChanged,
}: {
  courseId: number;
  docId: string;
  materials: Material[];
  sections: DocumentSection[];
  activeSectionIndex: number;
  bookmarks: Annotation[];
  highlights: Annotation[];
  onSelectMaterial: (docId: string) => void;
  onSelectSection: (index: number) => void;
  onAnnotationsChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("materials");

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-ink-border bg-ink-surface/40">
      <div className="flex border-b border-ink-border" role="tablist" aria-label="Reader sidebar sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            className={`flex flex-1 items-center justify-center py-2.5 transition-colors focus-ring ${
              tab === t.id ? "border-b-2 border-ai-accent text-ai-accent" : "text-paper-faint hover:text-paper-dim"
            }`}
          >
            <t.icon size={14} />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {tab === "materials" && (
          <>
            <p className="px-3 pb-2 font-mono text-[11px] uppercase tracking-widest text-paper-faint">Materials</p>
            <ul className="space-y-0.5 px-2">
              {materials.map((m) => (
                <li key={m.doc_id}>
                  <button
                    onClick={() => m.status === "ready" && onSelectMaterial(m.doc_id)}
                    disabled={m.status !== "ready"}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-ring ${
                      m.doc_id === docId
                        ? "bg-ai-accent/15 text-ai-accent"
                        : m.status === "ready"
                        ? "text-paper-dim hover:bg-ink-border hover:text-paper"
                        : "cursor-not-allowed text-paper-faint/60"
                    }`}
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="truncate">{m.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "contents" && (
          <TableOfContents sections={sections} activeIndex={activeSectionIndex} onSelect={onSelectSection} />
        )}

        {tab === "bookmarks" && (
          <ReaderBookmarks
            courseId={courseId}
            docId={docId}
            bookmarks={bookmarks}
            onJump={onSelectSection}
            onChanged={onAnnotationsChanged}
          />
        )}

        {tab === "highlights" && (
          <ReaderHighlights
            courseId={courseId}
            docId={docId}
            highlights={highlights}
            onJump={onSelectSection}
            onChanged={onAnnotationsChanged}
          />
        )}
      </div>
    </div>
  );
}
