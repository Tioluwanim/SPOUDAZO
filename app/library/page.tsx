"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Library, ChevronRight, Clock, Bookmark, Heart, FileText, Flame, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import {
  listCourses,
  listTopics,
  listRecentDocuments,
  listAllBookmarks,
  listFavoriteDocuments,
  getReadingAnalytics,
} from "@/lib/api";
import type { Course, Topic, RecentDocument, Bookmark as BookmarkType, ReadingStats } from "@/lib/types";

function formatMinutesRead(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ course: Course; topics: Topic[] }[]>([]);
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [favorites, setFavorites] = useState<RecentDocument[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    listCourses()
      .then(async (courses) => {
        const results = await Promise.all(
          courses.map(async (course) => ({
            course,
            topics: await listTopics(course.id).catch(() => []),
          }))
        );
        setGroups(results);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load your library", "error"))
      .finally(() => setLoading(false));

    // Independent of the course/topic load above - one section failing
    // (e.g. no bookmarks yet) shouldn't block the others from showing.
    listRecentDocuments(6).then(setRecent).catch(() => {});
    listAllBookmarks(10).then(setBookmarks).catch(() => {});
    listFavoriteDocuments().then(setFavorites).catch(() => {});
    getReadingAnalytics().then(setStats).catch(() => {});
  }, [authLoading, user, push]);

  if (authLoading || !user) return null;

  const hasAnyTopics = groups.some((g) => g.topics.length > 0);

  return (
    <AppShell>
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
          Smart Library
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
          Notes and online resources, by topic
        </h1>
        <p className="mt-2 max-w-xl text-sm text-paper-dim">
          Pick a topic to see what you&apos;ve uploaded alongside articles and explainers found
          around the web for it.
        </p>
      </div>

      {stats && (stats.documents_started > 0 || stats.total_seconds_read > 0) && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-1.5 text-paper-faint">
              <Flame size={13} />
              <span className="text-[11px] uppercase tracking-wide">Streak</span>
            </div>
            <p className="font-display text-xl text-paper">
              {stats.current_streak_days} day{stats.current_streak_days === 1 ? "" : "s"}
            </p>
          </Card>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-1.5 text-paper-faint">
              <Clock size={13} />
              <span className="text-[11px] uppercase tracking-wide">Time read</span>
            </div>
            <p className="font-display text-xl text-paper">{formatMinutesRead(stats.total_seconds_read)}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-1.5 text-paper-faint">
              <BookOpen size={13} />
              <span className="text-[11px] uppercase tracking-wide">Documents</span>
            </div>
            <p className="font-display text-xl text-paper">
              {stats.documents_completed}/{stats.documents_started}
            </p>
          </Card>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-1.5 text-paper-faint">
              <Bookmark size={13} />
              <span className="text-[11px] uppercase tracking-wide">Highlights</span>
            </div>
            <p className="font-display text-xl text-paper">{stats.highlight_count + stats.bookmark_count}</p>
          </Card>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={14} className="text-paper-faint" />
            <h2 className="font-display text-sm text-paper">Continue reading</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((r) => (
              <Link
                key={r.doc_id}
                href={`/courses/${r.course_id}/materials/${r.doc_id}`}
                className="w-52 shrink-0 rounded-xl border border-ink-border bg-ink-surface/40 p-3.5 transition-colors hover:border-ai-accent/40"
              >
                <FileText size={16} className="mb-2 text-paper-faint" />
                <p className="truncate text-sm text-paper">{r.filename}</p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-border/60">
                  <div className="h-full rounded-full bg-ai-accent" style={{ width: `${r.progress_percent}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-paper-faint">{r.progress_percent}% read</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(bookmarks.length > 0 || favorites.length > 0) && (
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          {bookmarks.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Bookmark size={14} className="text-paper-faint" />
                <h2 className="font-display text-sm text-paper">Bookmarks</h2>
              </div>
              <Card className="divide-y divide-ink-border p-0">
                {bookmarks.map((b) => (
                  <Link
                    key={b.id}
                    href={`/courses/${b.course_id}/materials/${b.doc_id}`}
                    className="block px-4 py-3 text-sm transition-colors hover:bg-ink-surface"
                  >
                    <p className="truncate text-paper-dim">&ldquo;{b.quote}&rdquo;</p>
                    {b.note && <p className="mt-1 text-xs text-paper-faint">{b.note}</p>}
                    <p className="mt-1 truncate text-[11px] text-paper-faint">{b.filename}</p>
                  </Link>
                ))}
              </Card>
            </div>
          )}

          {favorites.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Heart size={14} className="text-paper-faint" />
                <h2 className="font-display text-sm text-paper">Favorites</h2>
              </div>
              <Card className="divide-y divide-ink-border p-0">
                {favorites.map((f) => (
                  <Link
                    key={f.doc_id}
                    href={`/courses/${f.course_id}/materials/${f.doc_id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-ink-surface"
                  >
                    <span className="truncate text-paper">{f.filename}</span>
                    <ChevronRight size={15} className="shrink-0 text-paper-faint" />
                  </Link>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading your library…" />
      ) : !hasAnyTopics ? (
        <EmptyState
          icon={Library}
          title="Nothing to browse yet"
          body="Upload materials to a course and extract its topics — they'll show up here."
          action={
            <Link href="/dashboard">
              <span className="text-sm text-ai-accent hover:underline">Go to your courses</span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.topics.length > 0)
            .map(({ course, topics }) => (
              <div key={course.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                      {course.code}
                    </span>
                    <h2 className="font-display text-lg text-paper">{course.name}</h2>
                  </div>
                  <Link href={`/courses/${course.id}`} className="text-xs text-ai-accent hover:underline">
                    Open course
                  </Link>
                </div>
                <Card className="divide-y divide-ink-border p-0">
                  {topics.map((topic) => (
                    <Link
                      key={topic.id}
                      href={`/courses/${course.id}/topics/${topic.id}?tab=resources`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-ink-surface"
                    >
                      <span className="truncate text-paper">{topic.name}</span>
                      <ChevronRight size={15} className="shrink-0 text-paper-faint" />
                    </Link>
                  ))}
                </Card>
              </div>
            ))}
        </div>
      )}
    </AppShell>
  );
}
