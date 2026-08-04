"use client";

import Link from "next/link";
import { ArrowLeft, Download, Heart, Image as ImageIcon, Menu, BookOpen, FileStack } from "lucide-react";
import { DocumentSearch } from "@/components/reader/DocumentSearch";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { estimateReadingMinutes } from "@/components/reader/ReaderProgress";

export type ReaderMode = "ai" | "pdf";

export function ReaderToolbar({
  courseId,
  filename,
  wordCount,
  mode,
  onModeChange,
  sidebarOpen,
  onToggleSidebar,
  favorited,
  onToggleFavorite,
  thumbnailsOpen,
  onToggleThumbnails,
  showThumbnailsToggle,
  query,
  onQueryChange,
  matchCount,
  zoom,
  onZoomChange,
  onDownload,
}: {
  courseId: number;
  filename: string;
  wordCount: number;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  favorited: boolean;
  onToggleFavorite: () => void;
  thumbnailsOpen: boolean;
  onToggleThumbnails: () => void;
  showThumbnailsToggle: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  zoom: number;
  onZoomChange: (z: number) => void;
  onDownload: (() => void) | null;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-border px-4 py-2.5">
      <Link
        href={`/courses/${courseId}`}
        className="flex items-center gap-1.5 text-sm text-paper-dim hover:text-paper focus-ring"
      >
        <ArrowLeft size={16} /> Course
      </Link>
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        aria-pressed={sidebarOpen}
        className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
      >
        <Menu size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm text-paper">{filename}</p>
        {wordCount > 0 && mode === "ai" && (
          <p className="text-[11px] text-paper-faint">~{estimateReadingMinutes(wordCount)} min read</p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center rounded-full border border-ink-border bg-ink-surface/60 p-0.5" role="tablist" aria-label="Reader mode">
        <button
          role="tab"
          aria-selected={mode === "ai"}
          onClick={() => onModeChange("ai")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
            mode === "ai" ? "bg-gold text-[#2B2B2B]" : "text-paper-dim hover:text-paper"
          }`}
        >
          <BookOpen size={13} /> AI Reading
        </button>
        <button
          role="tab"
          aria-selected={mode === "pdf"}
          onClick={() => onModeChange("pdf")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
            mode === "pdf" ? "bg-gold text-[#2B2B2B]" : "text-paper-dim hover:text-paper"
          }`}
        >
          <FileStack size={13} /> Original PDF
        </button>
      </div>

      <button
        onClick={onToggleFavorite}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
      >
        <Heart size={15} className={favorited ? "fill-danger text-danger" : ""} />
      </button>

      {showThumbnailsToggle && (
        <button
          onClick={onToggleThumbnails}
          aria-label="Toggle page thumbnails"
          aria-pressed={thumbnailsOpen}
          className={`rounded-lg p-1.5 hover:bg-ink-border focus-ring ${
            thumbnailsOpen ? "text-ai-accent" : "text-paper-dim hover:text-paper"
          }`}
        >
          <ImageIcon size={15} />
        </button>
      )}

      <div className="hidden sm:block">
        <DocumentSearch mode={mode} query={query} onChange={onQueryChange} matchCount={matchCount} />
      </div>

      <ReaderSettings zoom={zoom} onZoomChange={onZoomChange} />

      {onDownload && (
        <button
          onClick={onDownload}
          aria-label="Download original file"
          className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
        >
          <Download size={15} />
        </button>
      )}
    </div>
  );
}
