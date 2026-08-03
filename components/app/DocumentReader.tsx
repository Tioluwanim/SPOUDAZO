"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X as XIcon } from "lucide-react";
import { CourseChat } from "@/components/app/CourseChat";
import { AuthedThumbnail } from "@/components/app/AuthedThumbnail";
import { HighlightToolbar } from "@/components/app/HighlightToolbar";
import { DefinitionPopover } from "@/components/app/DefinitionPopover";
import { AIAssistantPanel } from "@/components/reader/AIAssistantPanel";
import { ReaderToolbar, type ReaderMode } from "@/components/reader/ReaderToolbar";
import { ReaderProgress } from "@/components/reader/ReaderProgress";
import { ReaderSidebar } from "@/components/reader/ReaderSidebar";
import { ExtractedReader } from "@/components/reader/ExtractedReader";
import { PDFViewer } from "@/components/reader/PDFViewer";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useCourseChat } from "@/lib/useCourseChat";
import { getCachedMaterialDetail } from "@/lib/documentCache";
import {
  downloadOriginalFile,
  getReadingProgress,
  listAnnotations,
  listMaterials,
  toggleFavorite,
  updateReadingProgress,
} from "@/lib/api";
import type { Annotation, Material, MaterialDetail } from "@/lib/types";

export function DocumentReader({ courseId, docId }: { courseId: number; docId: string }) {
  const { push } = useToast();
  const router = useRouter();
  const chat = useCourseChat(courseId, docId, 0);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [doc, setDoc] = useState<MaterialDetail | null>(null);
  const [highlights, setHighlights] = useState<Annotation[]>([]);
  const [stickyNotes, setStickyNotes] = useState<Annotation[]>([]);
  const [bookmarks, setBookmarks] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const [resumedScroll, setResumedScroll] = useState(false);
  const [visibleSectionIndex, setVisibleSectionIndex] = useState(0);
  const [mode, setMode] = useState<ReaderMode>("ai");

  const readingRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const pdfGoToPageRef = useRef<((page: number) => void) | null>(null);
  const lastProgressSaveRef = useRef(0);
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refetchHighlights() {
    listAnnotations(courseId, docId, "highlight").then(setHighlights).catch(() => {});
  }
  function refetchStickyNotes() {
    listAnnotations(courseId, docId, "sticky_note").then(setStickyNotes).catch(() => {});
  }
  function refetchBookmarks() {
    listAnnotations(courseId, docId, "bookmark").then(setBookmarks).catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    setNotReadyMessage(null);
    setResumedScroll(false);
    Promise.all([listMaterials(courseId), getCachedMaterialDetail(courseId, docId)])
      .then(([materialList, detail]) => {
        setMaterials(materialList);
        setDoc(detail);
        refetchHighlights();
        refetchStickyNotes();
        refetchBookmarks();
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
  }, [courseId, docId, push]);

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
    if (!doc || !query.trim() || mode !== "ai") return new Set<number>();
    const q = query.trim().toLowerCase();
    return new Set(
      doc.sections
        .map((s, i) => ((s.title + " " + s.content).toLowerCase().includes(q) ? i : -1))
        .filter((i) => i !== -1)
    );
  }, [doc, query, mode]);

  const highlightsBySection = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const h of highlights) {
      const list = map.get(h.section_index) || [];
      list.push(h.quote);
      map.set(h.section_index, list);
    }
    return map;
  }, [highlights]);

  const stickyNotesBySection = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const n of stickyNotes) {
      const list = map.get(n.section_index) || [];
      list.push(n);
      map.set(n.section_index, list);
    }
    return map;
  }, [stickyNotes]);

  function jumpToSection(index: number) {
    // Sync across modes: in AI Reading this scrolls; in Original PDF it
    // navigates to that section's page instead, since page numbers (not
    // DOM scroll position) are what the PDF mode understands.
    if (mode === "pdf") {
      const page = doc?.sections[index]?.page_start;
      if (page) pdfGoToPageRef.current?.(page);
      return;
    }
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
    if (!el || mode !== "ai") return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0;
    setProgress(pct);
    const idx = currentSectionIndex();
    setVisibleSectionIndex(idx);
    saveProgressDebounced(idx, pct);
  }

  function saveProgressDebounced(sectionIndex: number, pct: number) {
    if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
    progressSaveTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const secondsDelta = lastProgressSaveRef.current ? Math.round((now - lastProgressSaveRef.current) / 1000) : 0;
      lastProgressSaveRef.current = now;
      updateReadingProgress(courseId, docId, sectionIndex, pct, secondsDelta).catch(() => {});
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

  async function handleDownload() {
    if (!doc) return;
    try {
      await downloadOriginalFile(courseId, docId, doc.filename);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't download this file", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading document…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-ink">
      <ReaderToolbar
        courseId={courseId}
        filename={doc?.filename ?? "Document"}
        wordCount={doc?.word_count ?? 0}
        mode={mode}
        onModeChange={setMode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        favorited={favorited}
        onToggleFavorite={handleToggleFavorite}
        thumbnailsOpen={thumbnailsOpen}
        onToggleThumbnails={() => setThumbnailsOpen((v) => !v)}
        showThumbnailsToggle={mode === "ai" && !!doc && doc.page_count > 0}
        query={query}
        onQueryChange={setQuery}
        matchCount={matchingSectionIndexes.size}
        zoom={zoom}
        onZoomChange={setZoom}
        onDownload={doc ? handleDownload : null}
      />

      <ReaderProgress percent={progress} />

      {thumbnailsOpen && mode === "ai" && doc && doc.page_count > 0 && (
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
        {sidebarOpen && (
          <div className="hidden lg:flex">
            <ReaderSidebar
              courseId={courseId}
              docId={docId}
              materials={materials}
              sections={doc?.sections ?? []}
              activeSectionIndex={visibleSectionIndex}
              bookmarks={bookmarks}
              highlights={highlights}
              onSelectMaterial={(id) => router.push(`/courses/${courseId}/materials/${id}`)}
              onSelectSection={jumpToSection}
              onAnnotationsChanged={() => {
                refetchBookmarks();
                refetchHighlights();
              }}
            />
          </div>
        )}

        <div ref={readingRef} onScroll={onReadingScroll} className="relative flex-1 overflow-y-auto">
          {notReadyMessage ? (
            <div className="px-6 py-10">
              <EmptyState icon={FileText} title="Still processing" body={notReadyMessage} />
            </div>
          ) : !doc || doc.sections.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState icon={FileText} title="Nothing to show yet" body="This document doesn't have any extracted sections." />
            </div>
          ) : mode === "pdf" ? (
            <PDFViewer courseId={courseId} docId={docId} currentPageRef={pdfGoToPageRef} />
          ) : (
            <>
              <ExtractedReader
                courseId={courseId}
                docId={docId}
                sections={doc.sections}
                highlightsBySection={highlightsBySection}
                stickyNotesBySection={stickyNotesBySection}
                matchingSectionIndexes={matchingSectionIndexes}
                zoom={zoom}
                sectionRefs={sectionRefs}
                onStickyNotesChanged={refetchStickyNotes}
              />
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

        <div className="hidden lg:flex">
          <AIAssistantPanel chat={chat} />
        </div>
      </div>

      {query.trim() && matchingSectionIndexes.size > 0 && mode === "ai" && (
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

      <div className="lg:hidden">
        <CourseChat courseId={courseId} />
      </div>
    </div>
  );
}
