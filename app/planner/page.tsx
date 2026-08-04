"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { listCourses, getStudyPlan } from "@/lib/api";
import type { Course, StudyPlan } from "@/lib/types";

export default function GlobalPlannerPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ course: Course; plan: StudyPlan | null }[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
    listCourses()
      .then(async (courses) => {
        const results = await Promise.all(
          courses.map(async (course) => ({
            course,
            plan: await getStudyPlan(course.id).catch(() => null),
          }))
        );
        setRows(results);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load your plans", "error"))
      .finally(() => setLoading(false));
  }, [authLoading, user, push]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
          Study Planner
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
          Your revision schedules
        </h1>
        <p className="mt-2 max-w-xl text-sm text-paper-dim">
          Each course keeps its own plan, scheduled around its own weak areas and exam date.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading your plans…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No courses yet"
          body="Add a course first, then build a revision plan for it once you've extracted topics."
          action={
            <Link href="/dashboard">
              <span className="text-sm text-ai-accent hover:underline">Go to your courses</span>
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-ink-border p-0">
          {rows.map(({ course, plan }) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}/planner`}
              className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-ink-surface"
            >
              <div className="min-w-0">
                <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                  {course.code}
                </span>
                <p className="truncate font-display text-base text-paper">{course.name}</p>
                {plan ? (
                  <p className="mt-1 text-sm text-paper-dim">
                    Exam{" "}
                    {new Date(plan.exam_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {plan.items.filter((i) => i.completed).length}/{plan.items.length} sessions
                    done
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-paper-faint">No plan yet</p>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-paper-faint" />
            </Link>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
