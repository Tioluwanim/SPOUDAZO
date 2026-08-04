"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Circle, BookOpen, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseSidebar } from "@/components/app/CourseSidebar";
import { CourseChat } from "@/components/app/CourseChat";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { useTaskProgress } from "@/lib/useTaskProgress";
import {
  getCourse,
  listTopics,
  getStudyPlan,
  createStudyPlan,
  setStudyPlanItemCompleted,
} from "@/lib/api";
import type { Course, Topic, StudyPlan, StudyPlanItem } from "@/lib/types";

export default function StudyPlannerPage({ params }: { params: { courseId: string } }) {
  const courseId = Number(params.courseId);
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const createTask = useTaskProgress("study_plan_create", 15, "Building your revision schedule…");

  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(2);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([getCourse(courseId), listTopics(courseId), getStudyPlan(courseId)])
      .then(([c, t, p]) => {
        setCourse(c);
        setTopics(t);
        setPlan(p);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load study planner", "error"))
      .finally(() => setLoading(false));
  }, [courseId, authLoading, user, push]);

  async function handleCreatePlan() {
    if (!examDate) return;
    const newPlan = await createTask.run(() =>
      createStudyPlan(courseId, new Date(examDate).toISOString(), hoursPerDay)
    );
    if (newPlan) {
      setPlan(newPlan);
      if (newPlan.compressed) {
        push(
          "Exam date is close - some well-mastered topics were dropped from the plan to fit the rest in.",
          "error"
        );
      }
    }
  }

  async function toggleComplete(item: StudyPlanItem) {
    if (!plan) return;
    const nextCompleted = !item.completed;
    // optimistic update
    setPlan({
      ...plan,
      items: plan.items.map((i) => (i.id === item.id ? { ...i, completed: nextCompleted } : i)),
    });
    try {
      await setStudyPlanItemCompleted(item.id, nextCompleted);
    } catch (err) {
      // roll back on failure
      setPlan((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, completed: item.completed } : i)) }
          : prev
      );
      push(err instanceof Error ? err.message : "Couldn't update that item", "error");
    }
  }

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <Spinner label="Loading study planner…" />
      </AppShell>
    );
  }

  if (!course) return null;

  if (topics.length === 0) {
    return (
      <AppShell
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: course.code, href: `/courses/${courseId}` },
          { label: "Study planner" },
        ]}
        sidebar={<CourseSidebar course={course} courseId={courseId} topics={topics} />}
      >
        <EmptyState
          icon={CalendarDays}
          title="Extract topics first"
          body="The study planner schedules revision around your course's topics - head back to the overview and extract topics from your uploaded materials before building a plan."
          action={
            <Link href={`/courses/${courseId}`}>
              <Button>Back to overview</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const groupedByDate = groupItemsByDate(plan?.items ?? []);

  return (
    <>
      <AppShell
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: course.code, href: `/courses/${courseId}` },
          { label: "Study planner" },
        ]}
        sidebar={<CourseSidebar course={course} courseId={courseId} topics={topics} />}
      >
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
            Study planner
          </span>
          <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
            {plan ? "Your revision schedule" : "Build your revision schedule"}
          </h1>
        </div>

        {!plan ? (
          <Card className="max-w-md p-6">
            <div className="mb-1 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold-deep">
                <CalendarDays size={18} />
              </span>
              <p className="font-display text-base text-paper">Set your exam date</p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-paper-dim">Exam date</label>
                <input
                  type="date"
                  value={examDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-paper focus-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-paper-dim">
                  Hours available per day
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-paper focus-ring"
                />
                <p className="mt-1.5 text-xs text-paper-faint">
                  Roughly one topic per hour - weakest topics get scheduled first, and revisited
                  again if there's time before your exam.
                </p>
              </div>
              <Button onClick={handleCreatePlan} loading={createTask.status === "running"} disabled={!examDate} className="w-full">
                Build my plan
              </Button>
              {createTask.status !== "idle" && (
                <TaskProgress
                  status={createTask.status}
                  step={createTask.step}
                  progressPercent={createTask.progressPercent}
                  etaLabel={createTask.etaLabel}
                  errorMessage={createTask.errorMessage}
                  onRetry={createTask.retry}
                  compact
                />
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {(() => {
              const total = plan.items.length;
              const done = plan.items.filter((i) => i.completed).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div className="rounded-xl border border-ink-border bg-ink-surface p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-paper-dim">Plan progress</span>
                    <span className="font-mono text-paper">
                      {done}/{total} · {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-border bg-ink-surface px-4 py-3 text-sm text-paper-dim">
              <span>
                Exam on{" "}
                <strong className="text-paper">
                  {new Date(plan.exam_date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </strong>{" "}
                · {plan.hours_per_day}h/day
              </span>
              <button
                onClick={() => setPlan(null)}
                className="text-xs text-gold-deep hover:underline focus-ring"
              >
                Rebuild plan
              </button>
            </div>

            {plan.compressed && (
              <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-paper">
                Your exam date is close, so some already-strong topics were left off to fit the
                rest of your revision in before then.
              </div>
            )}

            <div className="space-y-6">
              {groupedByDate.map(([date, items], i) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <p className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">
                    {new Date(date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <Card className="divide-y divide-ink-border p-0">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-gold/5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <button
                          onClick={() => toggleComplete(item)}
                          className="flex min-w-0 items-center gap-3 text-left focus-ring"
                        >
                          {item.completed ? (
                            <CheckCircle2 size={18} className="shrink-0 text-success" />
                          ) : (
                            <Circle size={18} className="shrink-0 text-paper-faint" />
                          )}
                          <span
                            className={
                              item.completed
                                ? "truncate text-sm text-paper-faint line-through"
                                : "truncate text-sm text-paper"
                            }
                          >
                            {item.topic_name}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 pl-8 sm:pl-0">
                          <Link href={`/courses/${courseId}/topics/${item.topic_id}?tab=theory`}>
                            <button className="flex items-center gap-1 rounded-full border border-ink-border px-2.5 py-1 text-xs text-paper-dim transition-colors hover:border-gold-deep/50 hover:text-paper focus-ring">
                              <BookOpen size={12} /> Theory
                            </button>
                          </Link>
                          <Link href={`/courses/${courseId}/topics/${item.topic_id}?tab=cbt`}>
                            <button className="flex items-center gap-1 rounded-full border border-ink-border px-2.5 py-1 text-xs text-paper-dim transition-colors hover:border-gold-deep/50 hover:text-paper focus-ring">
                              <ListChecks size={12} /> CBT
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </AppShell>
      <CourseChat courseId={courseId} />
    </>
  );
}

function groupItemsByDate(items: StudyPlanItem[]): [string, StudyPlanItem[]][] {
  const map = new Map<string, StudyPlanItem[]>();
  for (const item of items) {
    const key = item.scheduled_date.split("T")[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
