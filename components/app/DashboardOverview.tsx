"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, BookOpen, Highlighter, Bookmark } from "lucide-react";
import type { ReadingStats, RecentDocument } from "@/lib/types";

/**
 * Real-data dashboard strip - deliberately built only from fields the
 * backend actually returns (ReadingStats via getReadingAnalytics,
 * RecentDocument via listRecentDocuments). No streaks or progress bars
 * invented here; if a student has no reading history yet, the widgets
 * just don't render rather than showing fake placeholder numbers.
 */
export function DashboardOverview({
  stats,
  recent,
}: {
  stats: ReadingStats | null;
  recent: RecentDocument[];
}) {
  const mostRecent = recent[0];
  const hasAnyStats = stats && (stats.active_days > 0 || stats.documents_started > 0);

  if (!hasAnyStats && !mostRecent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {stats && stats.current_streak_days > 0 && (
        <div className="rounded-2xl border border-ink-border bg-ink-surface/60 p-5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-paper-faint">
            <Flame size={12} className="text-gold-deep" />
            Study streak
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-3xl text-paper">{stats.current_streak_days}</span>
            <span className="text-sm text-paper-dim">
              day{stats.current_streak_days === 1 ? "" : "s"} running
            </span>
          </div>
        </div>
      )}

      {mostRecent && (
        <Link
          href={`/courses/${mostRecent.course_id}/materials/${mostRecent.doc_id}`}
          className="group rounded-2xl border border-ink-border bg-ink-surface/60 p-5 transition-colors hover:border-gold/40"
        >
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-paper-faint">
            <BookOpen size={12} className="text-gold-deep" />
            Continue reading
          </div>
          <p className="mt-2 truncate font-display text-base text-paper">{mostRecent.filename}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round(mostRecent.progress_percent)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-paper-faint">
            {Math.round(mostRecent.progress_percent)}% through · resume
            <span className="ml-1 text-gold-deep transition-transform group-hover:translate-x-0.5 inline-block">
              →
            </span>
          </p>
        </Link>
      )}

      {stats && (stats.highlight_count > 0 || stats.bookmark_count > 0 || stats.documents_completed > 0) && (
        <div className="rounded-2xl border border-ink-border bg-ink-surface/60 p-5">
          <div className="font-mono text-[11px] uppercase tracking-wide text-paper-faint">
            Library
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-paper-dim">
                <BookOpen size={13} className="text-paper-faint" /> Completed
              </span>
              <span className="font-mono text-paper">{stats.documents_completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-paper-dim">
                <Highlighter size={13} className="text-paper-faint" /> Highlights
              </span>
              <span className="font-mono text-paper">{stats.highlight_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-paper-dim">
                <Bookmark size={13} className="text-paper-faint" /> Bookmarks
              </span>
              <span className="font-mono text-paper">{stats.bookmark_count}</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
