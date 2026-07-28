"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Heart,
  Image as ImageIcon,
  Menu,
  Search,
  X as XIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CourseChat } from "@/components/app/CourseChat";
import { ReaderAIPanel } from "@/components/app/ReaderAIPanel";
import { HighlightToolbar } from "@/components/app/HighlightToolbar";
import { DefinitionPopover } from "@/components/app/DefinitionPopover";
import { AuthedThumbnail } from "@/components/app/AuthedThumbnail";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { useCourseChat } from "@/lib/useCourseChat";
import {
  getMaterialDetail,
  getReadingProgress,
  listAnnotations,
  listMaterials,
  toggleFavorite,
  updateReadingProgress,
} from "@/lib/api";
import type { Annotation, Material, MaterialDetail } from "@/lib/types";

const ZOOM_STEP = 10;
const ZOOM_MIN = 80;
const ZOOM_MAX = 150;
const PROGRESS_SAVE_INTERVAL_MS = 3000;

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
    if (r.start < cursor) return; // overlapping with a previous range - skip
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

export default function DocumentReaderPage({
  params,
}: {
  params: { courseId: string; docId: string };
}) {
  const courseId = Number(params.courseId);
  const docId = params.docId;
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const chat = useCourseChat(courseId);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [doc, setDoc] = useState<MaterialDetail | null>(null);
  const [highlights, setHighlights] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const [resumedScroll, setResumedScroll] = useState(false);

  const readingRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const lastProgressSaveRef = useRef(0);
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refetchHighlights() {
    listAnnotations(courseId, docId, "highlight").then(setHighlights).catch(() => {});
  }

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    setNotReadyMessage(null);
    setResumedScroll(false);
    Promise.all([listMaterials(courseId), getMaterialDetail(courseId, docId)])
      .then(([materialList, detail]) => {
        setMaterials(materialList);
        setDoc(detail);
        refetchHighlights();
        getReadingProgress(courseId, docId)
          .then((p) => setProgress(p?.progress_percent ?? 0))
          .catch(() => {});
      })
      .catch((err) => {
        if (err instanceof Error && /still processing/i.test(err.message)) {
          setNotReadyMessage(err.message);
          listMaterials(courseId).then(setMaterials).catch(() => {});
        } else {
          push(err instanceof Error ? err.message : "Couldn't load this document", "error");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, courseId, docId, push]);

  // Resume where the student left off, once (not on every re-render).
  useEffect(() => {
    if (resumedScroll || !doc || loading) return;
    getReadingProgress(courseId, docId)
      .then((p) => {
        if (p && p.last_section_index > 0) {
          requestAnimationFrame(() => jumpToSection(p.last_section_index));
        }
      })
      .catch(() => {})
      .finally(() => setResumedScroll(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, loading, resumedScroll]);

  const matchingSectionIndexes = useMemo(() => {
    if (!doc || !query.trim()) return new Set<number>();
    const q = query.trim().toLowerCase();
    return new Set(
      doc.sections
        .map((s, i) => ((s.title + " " + s.content).toLowerCase().includes(q) ? i : -1))
        .filter((i) => i !== -1)
    );
  }, [doc, query]);

  const highlightsBySection = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const h of highlights) {
      const list = map.get(h.section_index) || [];
      list.push(h.quote);
      map.set(h.section_index, list);
    }
    return map;
  }, [highlights]);

  function jumpToSection(index: number) {
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function currentSectionIndex(): number {
    const container = readingRef.current;
    if (!container) return 0;
    const containerTop = container.getBoundingClientRect().top;
    let best = 0;
    for (const [idx, el] of Object.entries(sectionRefs.current)) {
      if (!el) continue;
      if (el.getBoundingClientRect().top - containerTop <= 80) best = Number(idx);
    }
    return best;
  }

  function onReadingScroll() {
    const el = readingRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0;
    setProgress(pct);

    // Debounced save - reading scroll fires constantly; the backend only
    // needs to know roughly where the student ended up, not every pixel
    // of the journey there.
    if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
    progressSaveTimerRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastProgressSaveRef.current < PROGRESS_SAVE_INTERVAL_MS) return;
      // Seconds since the last successful save - this is "time the reader
      // was open and being scrolled," a reasonable proxy for active
      // reading time without needing focus/blur/idle-detection plumbing.
      const secondsDelta = lastProgressSaveRef.current
        ? Math.round((now - lastProgressSaveRef.current) / 1000)
        : 0;
      lastProgressSaveRef.current = now;
      updateReadingProgress(courseId, docId, currentSectionIndex(), pct, secondsDelta).catch(() => {});
    }, 400);
  }

  async function handleToggleFavorite() {
    try {
      const res = await toggleFavorite(courseId, docId);
      setFavorited(res.favorited);
      push(res.favorited ? "Added to favorites" : "Removed from favorites");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update favorites", "error");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading document…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-ink">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-ink-border px-4 py-2.5">
        <Link
          href={`/courses/${courseId}`}
          className="flex items-center gap-1.5 text-sm text-paper-dim hover:text-paper focus-ring"
        >
          <ArrowLeft size={16} /> Course
        </Link>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle sidebar"
          className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
        >
          <Menu size={16} />
        </button>

        <p className="min-w-0 flex-1 truncate font-display text-sm text-paper">
          {doc?.filename ?? "Document"}
        </p>

        <button
          onClick={handleToggleFavorite}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
        >
          <Heart size={15} className={favorited ? "fill-danger text-danger" : ""} />
        </button>

        {doc && doc.page_count > 0 && (
          <button
            onClick={() => setThumbnailsOpen((v) => !v)}
            aria-label="Toggle page thumbnails"
            className={`rounded-lg p-1.5 hover:bg-ink-border focus-ring ${
              thumbnailsOpen ? "text-ai-accent" : "text-paper-dim hover:text-paper"
            }`}
          >
            <ImageIcon size={15} />
          </button>
        )}

        <div className="hidden items-center gap-1 sm:flex">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-paper-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in document"
              className="w-44 rounded-lg border border-ink-border bg-ink-surface py-1.5 pl-7 pr-2 text-xs text-paper placeholder:text-paper-faint focus-ring"
            />
          </div>
          {query && (
            <span className="text-xs text-paper-faint">
              {matchingSectionIndexes.size} match{matchingSectionIndexes.size === 1 ? "" : "es"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 border-l border-ink-border pl-3">
          <button
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            aria-label="Zoom out"
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
          >
            <ZoomOut size={15} />
          </button>
          <span className="w-9 text-center text-xs text-paper-faint">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            aria-label="Zoom in"
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      {/* Reading progress */}
      <div className="h-0.5 w-full bg-ink-border/40">
        <div
          className="h-full bg-ai-accent transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Page thumbnail strip */}
      {thumbnailsOpen && doc && doc.page_count > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-ink-border bg-ink-surface/30 px-4 py-3">
          {Array.from({ length: doc.page_count }, (_, i) => i + 1).map((page) => (
            <AuthedThumbnail
              key={page}
              courseId={courseId}
              docId={docId}
              page={page}
              className="h-24 w-16 shrink-0 rounded-md border border-ink-border object-cover"
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        {sidebarOpen && (
          <div className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-border bg-ink-surface/40 py-3 lg:flex">
            <p className="px-3 pb-2 font-mono text-[11px] uppercase tracking-widest text-paper-faint">
              Materials
            </p>
            <ul className="space-y-0.5 px-2">
              {materials.map((m) => (
                <li key={m.doc_id}>
                  <button
                    onClick={() => m.status === "ready" && router.push(`/courses/${courseId}/materials/${m.doc_id}`)}
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
          </div>
        )}

        {/* Center reading pane */}
        <div ref={readingRef} onScroll={onReadingScroll} className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-10">
            {notReadyMessage ? (
              <EmptyState icon={FileText} title="Still processing" body={notReadyMessage} />
            ) : !doc || doc.sections.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nothing to show yet"
                body="This document doesn't have any extracted sections."
              />
            ) : (
              <article style={{ fontSize: `${zoom}%` }} className="space-y-10">
                {doc.sections.map((section, i) => {
                  const isMatch = query.trim() && matchingSectionIndexes.has(i);
                  return (
                    <section
                      key={i}
                      data-section-index={i}
                      ref={(el) => {
                        sectionRefs.current[i] = el;
                      }}
                      className={`scroll-mt-4 rounded-xl transition-colors ${
                        isMatch ? "bg-ai-accent/5 ring-1 ring-ai-accent/30" : ""
                      }`}
                    >
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <h2 className="font-display text-xl text-paper">{section.title}</h2>
                        {(section.page_start || section.page_end) > 0 && (
                          <span className="shrink-0 font-mono text-[11px] text-paper-faint">
                            {section.page_start === section.page_end
                              ? `p.${section.page_start}`
                              : `p.${section.page_start}–${section.page_end}`}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-line leading-relaxed text-paper-dim">
                        {renderWithHighlights(section.content, highlightsBySection.get(i) || [])}
                      </p>
                    </section>
                  );
                })}
              </article>
            )}
          </div>

          {doc && (
            <>
              <HighlightToolbar
                courseId={courseId}
                docId={docId}
                containerRef={readingRef}
                chat={chat}
                onHighlightCreated={refetchHighlights}
              />
              <DefinitionPopover courseId={courseId} docId={docId} containerRef={readingRef} />
            </>
          )}
        </div>

        {/* Right AI panel (desktop) */}
        <ReaderAIPanel chat={chat} />
      </div>

      {/* Mobile search jump */}
      {query.trim() && matchingSectionIndexes.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ink-border bg-ink-surface px-3 py-2 shadow-lg sm:hidden">
          <span className="text-xs text-paper-dim">{matchingSectionIndexes.size} matches</span>
          <button onClick={() => jumpToSection([...matchingSectionIndexes][0])} className="text-xs text-ai-accent">
            Jump
          </button>
          <button onClick={() => setQuery("")} aria-label="Clear search">
            <XIcon size={13} className="text-paper-faint" />
          </button>
        </div>
      )}

      {/* Mobile/tablet AI access - the docked panel only renders at lg+, so
          below that the existing floating widget covers the same job. */}
      <div className="lg:hidden">
        <CourseChat courseId={courseId} />
      </div>
    </div>
  );
}
