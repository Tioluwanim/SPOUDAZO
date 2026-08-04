"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
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
      <mark key={i} className="rounded bg-gold/30 px-0.5 text-paper">
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
    <article style={{ fontSize: `${zoom}%` }} className="mx-auto max-w-[42rem] px-6 py-10">
      {sections.map((section, i) => {
        const isMatch = matchingSectionIndexes.has(i);
        // Extraction sometimes chunks a document far finer than its real
        // headings (e.g. roughly per PDF page rather than per section) -
        // when a chunk has no real title, giving it a full header (eyebrow,
        // <h2>, page badge) makes it look like a new topic started, when
        // really it's a continuation of the previous chunk's paragraph.
        // Those render as a plain continuation instead: no header, no gap,
        // no divider - just the next stretch of the same running text.
        const hasTitle = section.title.trim().length > 0;

        // Only titled (real-boundary) sections get the scroll-reveal
        // wrapper, which costs one IntersectionObserver each. LazySection
        // below already runs its own observer per section for lazy-mount -
        // giving every section a second observer for a purely decorative
        // reveal is real overhead on a document chunked into many small
        // pieces, and untitled continuations don't visually read as a "new
        // block" anyway, so there's nothing lost by skipping it there.
        const Wrapper = hasTitle ? motion.section : "section";
        const wrapperMotionProps = hasTitle
          ? {
              initial: { opacity: 0, y: 10 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: "-60px" },
              transition: { duration: 0.4 },
            }
          : {};

        return (
          <Wrapper
            key={i}
            data-section-index={i}
            ref={(el: HTMLElement | null) => {
              sectionRefs.current[i] = el;
            }}
            aria-current={isMatch ? "true" : undefined}
            {...wrapperMotionProps}
            className={`scroll-mt-6 rounded-2xl transition-colors ${hasTitle ? "mt-16" : "mt-0"} ${
              isMatch ? "bg-gold/5 ring-1 ring-gold/30" : ""
            }`}
          >
            {hasTitle && (
              <>
                <div className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-paper-faint">
                  <span className="h-px w-5 bg-gold/50" />
                  Section {i + 1} of {sections.length}
                  {isMatch && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-gold-deep normal-case tracking-normal">
                      <Search size={10} /> Match
                    </span>
                  )}
                </div>
                <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink-border/60 pb-3">
                  <h2 className="font-display text-2xl leading-snug text-paper">{section.title}</h2>
                  {(section.page_start || section.page_end) > 0 && (
                    <span className="shrink-0 font-mono text-[11px] text-paper-faint">
                      {section.page_start === section.page_end
                        ? `p.${section.page_start}`
                        : `p.${section.page_start}–${section.page_end}`}
                    </span>
                  )}
                </div>
              </>
            )}
            <LazySection placeholderHeight={Math.min(400, section.content.length / 3)}>
              <p className="whitespace-pre-line text-[1.05rem] leading-[1.85] text-paper/90">
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
          </Wrapper>
        );
      })}
    </article>
  );
}
