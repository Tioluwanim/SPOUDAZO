"use client";

import { useEffect, useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CourseCard } from "@/components/app/CourseCard";
import { CreateCourseModal } from "@/components/app/CreateCourseModal";
import { EmptyState } from "@/components/app/EmptyState";
import { FirstTimeWalkthrough, hasSeenWalkthrough } from "@/components/app/FirstTimeWalkthrough";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getProfile } from "@/lib/session";
import { useRequireAuth } from "@/lib/auth";
import { listCourses } from "@/lib/api";
import type { Course } from "@/lib/types";

export default function DashboardPage() {
  const { push } = useToast();
  const { user, loading: authLoading } = useRequireAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!hasSeenWalkthrough()) setShowWalkthrough(true);
    listCourses()
      .then(setCourses)
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load courses", "error"))
      .finally(() => setLoading(false));
  }, [authLoading, user, push]);

  if (authLoading || !user) return null;

  const profile = getProfile();

  return (
    <AppShell>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-amber-glow">
            Dashboard
          </span>
          <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
            {profile?.name ? `Welcome back, ${profile.name}` : "Your courses"}
          </h1>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add course
        </Button>
      </div>

      {loading ? (
        <Spinner label="Loading your courses…" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          body="Add your first course, then upload lecture materials and past questions so Spoudazõ can start mining them for recurring topics."
          action={<Button onClick={() => setModalOpen(true)}>Add your first course</Button>}
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
        <FirstTimeWalkthrough onClose={() => setShowWalkthrough(false)} />
      )}
    </AppShell>
  );
}
