"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Library, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { listCourses, listTopics } from "@/lib/api";
import type { Course, Topic } from "@/lib/types";

export default function LibraryPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ course: Course; topics: Topic[] }[]>([]);

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