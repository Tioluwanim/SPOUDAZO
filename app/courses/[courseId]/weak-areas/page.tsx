"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingDown } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseSidebar } from "@/components/app/CourseSidebar";
import { CourseChat } from "@/components/app/CourseChat";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { getCourse, getWeakAreas, listTopics } from "@/lib/api";
import type { Course, Topic, WeakArea } from "@/lib/types";

export default function WeakAreasPage({ params }: { params: { courseId: string } }) {
  const courseId = Number(params.courseId);
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [areas, setAreas] = useState<WeakArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([getCourse(courseId), listTopics(courseId), getWeakAreas(courseId, 20)])
      .then(([c, t, w]) => {
        setCourse(c);
        setTopics(t);
        setAreas(w);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load weak areas", "error"))
      .finally(() => setLoading(false));
  }, [courseId, authLoading, user, push]);

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <Spinner label="Ranking your weak areas…" />
      </AppShell>
    );
  }

  if (!course) return null;

  return (
    <>
    <AppShell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: course.code, href: `/courses/${courseId}` },
        { label: "Weak areas" },
      ]}
      sidebar={<CourseSidebar course={course} courseId={courseId} topics={topics} />}
    >
      <div className="mb-10">
        <span className="font-mono text-xs uppercase tracking-widest text-danger">
          Ranked by mastery
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
          Where to focus your next session
        </h1>
        <p className="mt-2 max-w-lg text-paper-dim">
          Lowest mastery first — updated after every theory and CBT attempt
          you submit.
        </p>
      </div>

      {areas.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No attempts yet"
          body="Answer a few theory or CBT questions in this course and your weakest topics will show up here."
        />
      ) : (
        <div className="space-y-3">
          {areas.map((area, i) => (
            <motion.div
              key={area.topic_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <Link href={`/courses/${courseId}/topics/${area.topic_id}`}>
                <Card className="flex items-center gap-5 p-5 transition-colors hover:border-ai-accent/50">
                  <span className="font-mono text-xs text-paper-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base text-paper">{area.name}</h3>
                    <div className="mt-2 max-w-xs">
                      <ProgressBar
                        value={area.mastery_score}
                        tone={area.mastery_score < 40 ? "danger" : area.mastery_score < 70 ? "achievement" : "success"}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-sm text-paper-dim">{area.mastery_score}%</span>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
    <CourseChat courseId={courseId} />
    </>
  );
}