"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { listCourses, getWeakAreas } from "@/lib/api";
import type { Course, WeakArea } from "@/lib/types";

export default function GlobalProgressPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ course: Course; areas: WeakArea[] }[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
    listCourses()
      .then(async (courses) => {
        const results = await Promise.all(
          courses.map(async (course) => ({
            course,
            areas: await getWeakAreas(course.id, 5).catch(() => []),
          }))
        );
        setGroups(results);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load your progress", "error"))
      .finally(() => setLoading(false));
  }, [authLoading, user, push]);

  if (authLoading || !user) return null;

  const hasAnyAreas = groups.some((g) => g.areas.length > 0);

  function tone(score: number): "danger" | "achievement" | "success" {
    if (score < 40) return "danger";
    if (score < 75) return "achievement";
    return "success";
  }

  return (
    <AppShell>
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
          Progress
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
          Where you stand, across every course
        </h1>
        <p className="mt-2 max-w-xl text-sm text-paper-dim">
          Weakest topics first, pulled from your actual practice attempts — not self-reported
          confidence.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading your progress…" />
      ) : !hasAnyAreas ? (
        <EmptyState
          icon={BarChart3}
          title="No practice data yet"
          body="Once you start practicing theory or CBT questions, your weakest topics will show up here first."
          action={
            <Link href="/dashboard">
              <span className="text-sm text-ai-accent hover:underline">Go to your courses</span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.areas.length > 0)
            .map(({ course, areas }) => (
              <div key={course.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                      {course.code}
                    </span>
                    <h2 className="font-display text-lg text-paper">{course.name}</h2>
                  </div>
                  <Link
                    href={`/courses/${course.id}/weak-areas`}
                    className="text-xs text-ai-accent hover:underline"
                  >
                    Full breakdown
                  </Link>
                </div>
                <Card className="space-y-4 p-4">
                  {areas.map((a) => (
                    <Link
                      key={a.topic_id}
                      href={`/courses/${course.id}/topics/${a.topic_id}`}
                      className="block group"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="truncate text-paper group-hover:text-ai-accent">
                          {a.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-paper-faint">
                          {a.mastery_score}%
                        </span>
                      </div>
                      <ProgressBar value={a.mastery_score} tone={tone(a.mastery_score)} />
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