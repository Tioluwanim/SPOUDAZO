"use client";

import { LazySection } from "@/components/app/LazySection";
import { StickyNotes } from "@/components/app/StickyNotes";
import type { Annotation, DocumentSection } from "@/lib/types";

/** Wraps every occurrence of a saved highlight's quote in <mark>, so
 * highlights survive a reload instead of only existing for the session
 * they were made in. Non-overlapping, first-match-wins - good enough for
 * lecture-note prose; two highlights sharing overlapping text is an edge
 * case rare enough not to hold up shipping this. */
function renderWithHighlights(content: string, quotes: string[]): React.ReactNode {
  if (quotes.length === 0) return content;

  const ranges: { start: number; end: number }[] = [];
  for (const quote of quotes) {
    if (!quote) continue;
    const idx = content.indexOf(quote);
    if (idx === -1) continue;
    ranges.push({ start: idx, end: idx + quote.length });
  }
  if (ranges.length === 0) return content;
  ranges.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start < cursor) return;
    if (r.start > cursor) nodes.push(content.slice(cursor, r.start));
    nodes.push(
      <mark key={i} className="rounded bg-achievement/25 text-paper">
        {content.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes;
}

export function ExtractedReader({
  courseId,
  docId,
  sections,
  highlightsBySection,
  stickyNotesBySection,
  matchingSectionIndexes,
  zoom,
  sectionRefs,
  onStickyNotesChanged,
}: {
  courseId: number;
  docId: string;
  sections: DocumentSection[];
  highlightsBySection: Map<number, string[]>;
  stickyNotesBySection: Map<number, Annotation[]>;
  matchingSectionIndexes: Set<number>;
  zoom: number;
  sectionRefs: React.MutableRefObject<Record<number, HTMLElement | null>>;
  onStickyNotesChanged: () => void;
}) {
  return (
    <article style={{ fontSize: `${zoom}%` }} className="mx-auto max-w-[42rem] space-y-14 px-6 py-10">
      {sections.map((section, i) => {
        const isMatch = matchingSectionIndexes.has(i);
        return (
          <section
            key={i}
            data-section-index={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            aria-current={isMatch ? "true" : undefined}
            className={`scroll-mt-6 rounded-xl transition-colors ${
              isMatch ? "bg-ai-accent/5 ring-1 ring-ai-accent/30" : ""
            }`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink-border/60 pb-2">
              <h2 className="font-display text-2xl leading-snug text-paper">{section.title}</h2>
              {(section.page_start || section.page_end) > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-paper-faint">
                  {section.page_start === section.page_end
                    ? `p.${section.page_start}`
                    : `p.${section.page_start}–${section.page_end}`}
                </span>
              )}
            </div>
            <LazySection placeholderHeight={Math.min(400, section.content.length / 3)}>
              <p className="whitespace-pre-line text-[1.05rem] leading-[1.85] text-paper-dim">
                {renderWithHighlights(section.content, highlightsBySection.get(i) || [])}
              </p>
              <StickyNotes
                courseId={courseId}
                docId={docId}
                sectionIndex={i}
                sectionTitle={section.title}
                notes={stickyNotesBySection.get(i) || []}
                onChanged={onStickyNotesChanged}
              />
            </LazySection>
          </section>
        );
      })}
    </article>
  );
}
