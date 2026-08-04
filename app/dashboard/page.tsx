"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseCard } from "@/components/app/CourseCard";
import { DashboardOverview } from "@/components/app/DashboardOverview";
import { CreateCourseModal } from "@/components/app/CreateCourseModal";
import { EmptyState } from "@/components/app/EmptyState";
import { Walkthrough, hasSeenWalkthrough } from "@/components/app/Walkthrough";
import { DASHBOARD_WALKTHROUGH } from "@/lib/walkthrough";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getProfile } from "@/lib/session";
import { useRequireAuth } from "@/lib/auth";
import { listCourses, getReadingAnalytics, listRecentDocuments } from "@/lib/api";
import type { Course, ReadingStats, RecentDocument } from "@/lib/types";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [recent, setRecent] = useState<RecentDocument[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
    // ?tour=1 lets the Profile page's "Replay walkthrough" link force the
    // tour even after it's been dismissed once.
    if (searchParams.get("tour") === "1" || !hasSeenWalkthrough()) {
      setShowWalkthrough(true);
    }
    listCourses()
      .then(setCourses)
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load courses", "error"))
      .finally(() => setLoading(false));

    // Overview strip data - fetched independently of the course list and
    // failing silently, since it's supplementary (a student with no
    // reading history yet shouldn't see an error toast for it).
    getReadingAnalytics().then(setStats).catch(() => {});
    listRecentDocuments(1).then(setRecent).catch(() => {});
  }, [authLoading, user, push, searchParams]);

  function closeWalkthrough() {
    setShowWalkthrough(false);
    if (searchParams.get("tour") === "1") router.replace("/dashboard");
  }

  if (authLoading || !user) return null;

  const profile = getProfile();

  return (
    <AppShell>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
            Dashboard
          </span>
          <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
            {profile?.name ? `Welcome back, ${profile.name}` : "Your courses"}
          </h1>
        </div>
        <Button onClick={() => setModalOpen(true)} data-tour="add-course">
          <Plus size={16} /> Add course
        </Button>
      </div>

      {!loading && <DashboardOverview stats={stats} recent={recent} />}

      {loading ? (
        <Spinner label="Loading your courses…" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          body="Add your first course, then upload lecture materials and past questions so Spoudazõ can start mining them for recurring topics."
          action={
            <Button onClick={() => setModalOpen(true)} data-tour="add-course">
              Add your first course
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <CourseCard key={course.id} course={course} index={i} />
          ))}
        </div>
      )}

      <CreateCourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(course) => setCourses((prev) => [course, ...prev])}
      />

      {showWalkthrough && (
        <Walkthrough steps={DASHBOARD_WALKTHROUGH} onClose={closeWalkthrough} />
      )}
    </AppShell>
  );
}
