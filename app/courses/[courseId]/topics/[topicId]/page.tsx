"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseSidebar } from "@/components/app/CourseSidebar";
import { CourseChat } from "@/components/app/CourseChat";
import { Spinner } from "@/components/ui/Spinner";
import { TheoryPractice } from "@/components/app/TheoryPractice";
import { CBTPractice } from "@/components/app/CBTPractice";
import { SmartLibraryResources } from "@/components/app/SmartLibraryResources";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { getCourse, listTopics } from "@/lib/api";
import type { Course, Topic } from "@/lib/types";

export default function TopicPracticePage({
  params,
}: {
  params: { courseId: string; topicId: string };
}) {
  return (
    <Suspense fallback={null}>
      <TopicPracticePageInner params={params} />
    </Suspense>
  );
}

function TopicPracticePageInner({
  params,
}: {
  params: { courseId: string; topicId: string };
}) {
  const courseId = Number(params.courseId);
  const topicId = Number(params.topicId);
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "cbt" ? "cbt" : searchParams.get("tab") === "resources" ? "resources" : "theory";
  const [tab, setTab] = useState<"theory" | "cbt" | "resources">(initialTab);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([getCourse(courseId), listTopics(courseId)])
      .then(([c, fetchedTopics]) => {
        setCourse(c);
        setTopics(fetchedTopics);
        const found = fetchedTopics.find((t) => t.id === topicId) || null;
        setTopic(found);
      })
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load topic", "error"))
      .finally(() => setLoading(false));
  }, [courseId, topicId, authLoading, user, push]);

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <Spinner label="Loading topic…" />
      </AppShell>
    );
  }

  if (!course || !topic) {
    return (
      <AppShell>
        <p className="text-paper-dim">Topic not found.</p>
      </AppShell>
    );
  }

  const sortedTopics = topics.slice().sort((a, b) => b.frequency_score - a.frequency_score);
  const currentIndex = sortedTopics.findIndex((t) => t.id === topicId);
  const prevTopic = currentIndex > 0 ? sortedTopics[currentIndex - 1] : null;
  const nextTopic =
    currentIndex >= 0 && currentIndex < sortedTopics.length - 1
      ? sortedTopics[currentIndex + 1]
      : null;

  return (
    <>
    <AppShell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: course.code, href: `/courses/${courseId}` },
        { label: topic.name },
      ]}
      sidebar={
        <CourseSidebar course={course} courseId={courseId} topics={topics} activeTopicId={topicId} />
      }
    >
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
          frequency score · {topic.frequency_score}
        </span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">{topic.name}</h1>
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-ink-border [scrollbar-width:none]">
        <TabButton active={tab === "theory"} onClick={() => setTab("theory")}>
          Theory practice
        </TabButton>
        <TabButton active={tab === "cbt"} onClick={() => setTab("cbt")}>
          CBT practice
        </TabButton>
        <TabButton active={tab === "resources"} onClick={() => setTab("resources")}>
          Resources
        </TabButton>
      </div>

      {tab === "theory" ? (
        <TheoryPractice topicId={topicId} />
      ) : tab === "cbt" ? (
        <CBTPractice topicId={topicId} />
      ) : (
        <SmartLibraryResources topicId={topicId} />
      )}

      {(prevTopic || nextTopic) && (
        <div className="mt-10 flex items-center justify-between border-t border-ink-border pt-6">
          {prevTopic ? (
            <Link
              href={`/courses/${courseId}/topics/${prevTopic.id}`}
              className="group flex items-center gap-2 text-sm text-paper-dim transition-colors hover:text-paper focus-ring"
            >
              <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              <span className="truncate">{prevTopic.name}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextTopic ? (
            <Link
              href={`/courses/${courseId}/topics/${nextTopic.id}`}
              className="group flex items-center gap-2 text-right text-sm text-paper-dim transition-colors hover:text-paper focus-ring"
            >
              <span className="truncate">{nextTopic.name}</span>
              <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </AppShell>
    <CourseChat courseId={courseId} />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative pb-3 text-sm font-medium transition-colors focus-ring",
        active ? "text-paper" : "text-paper-faint hover:text-paper-dim"
      )}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ai-accent" />
      )}
    </button>
  );
}