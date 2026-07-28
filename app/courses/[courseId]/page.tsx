"use client";

import { useEffect, useState } from "react";
import { Sparkles, Layers } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseSidebar } from "@/components/app/CourseSidebar";
import { CourseChat } from "@/components/app/CourseChat";
import { MaterialUploader } from "@/components/app/MaterialUploader";
import { MaterialsList } from "@/components/app/MaterialsList";
import { TopicCard } from "@/components/app/TopicCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { useTaskProgress } from "@/lib/useTaskProgress";
import { getCourse, listMaterials, listTopics, extractTopics } from "@/lib/api";
import type { Course, Material, Topic } from "@/lib/types";

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const courseId = Number(params.courseId);
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const extractTask = useTaskProgress("topic_extract", 20, "Extracting topics from your materials…");

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([getCourse(courseId), listMaterials(courseId), listTopics(courseId)])
      .then(([c, m, t]) => {
        setCourse(c);
        setMaterials(m);
        setTopics(t);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load course", "error"))
      .finally(() => setLoading(false));
  }, [courseId, authLoading, user, push]);

  // Uploads process in the background now (see spoudazo-api's materials.py) -
  // poll while any material hasn't reached a terminal state (ready/failed)
  // so status badges update without a manual refresh.
  useEffect(() => {
    const stillProcessing = materials.some((m) => m.status !== "ready" && m.status !== "failed");
    if (!stillProcessing) return;

    const interval = setInterval(() => {
      listMaterials(courseId)
        .then(setMaterials)
        .catch(() => {
          /* transient poll failure - next tick will retry, no need to toast */
        });
    }, 4000);

    return () => clearInterval(interval);
  }, [materials, courseId]);

  const readyMaterials = materials.filter((m) => m.status === "ready").length;

  async function handleExtract() {
    const result = await extractTask.run(() => extractTopics(courseId));
    if (result) {
      setTopics(result);
      push(`Found ${result.length} recurring topic${result.length === 1 ? "" : "s"}`);
    }
  }

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <Spinner label="Loading course…" />
      </AppShell>
    );
  }

  if (!course) return null;

  const maxFrequency = topics.reduce((max, t) => Math.max(max, t.frequency_score), 0);

  return (
    <>
    <AppShell
      crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: course.code }]}
      sidebar={<CourseSidebar course={course} courseId={courseId} topics={topics} />}
    >
      <div className="mb-10">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
          {course.code}
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">{course.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-paper">
            <Layers size={17} className="text-ai-accent" />
            Materials
          </h2>
          <MaterialUploader
            courseId={courseId}
            onUploaded={(material) =>
              setMaterials((prev) => [material, ...prev.filter((m) => m.doc_id !== material.doc_id)])
            }
          />
          <div className="mt-4">
            <MaterialsList materials={materials} courseId={courseId} />
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg text-paper">
              <Sparkles size={17} className="text-ai-accent" />
              Topics
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExtract}
              loading={extractTask.status === "running"}
              disabled={readyMaterials === 0}
            >
              {topics.length > 0 ? "Re-scan for topics" : "Extract topics"}
            </Button>
          </div>

          {extractTask.status !== "idle" && (
            <div className="mb-4">
              <TaskProgress
                status={extractTask.status}
                step={extractTask.step}
                progressPercent={extractTask.progressPercent}
                etaLabel={extractTask.etaLabel}
                errorMessage={extractTask.errorMessage}
                onRetry={extractTask.retry}
                compact
              />
            </div>
          )}

          {readyMaterials === 0 ? (
            <EmptyState
              icon={Layers}
              title="Upload materials first"
              body="Once at least one file finishes processing, you can run the frequency scan to find your course's recurring topics."
            />
          ) : topics.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No topics extracted yet"
              body="Run the scan to count which topics recur across your uploaded past questions and materials."
              action={
                <Button onClick={handleExtract} loading={extractTask.status === "running"}>
                  Extract topics
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {topics
                .slice()
                .sort((a, b) => b.frequency_score - a.frequency_score)
                .map((topic, i) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    courseId={courseId}
                    maxFrequency={maxFrequency}
                    index={i}
                  />
                ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
    <CourseChat courseId={courseId} />
    </>
  );
}
