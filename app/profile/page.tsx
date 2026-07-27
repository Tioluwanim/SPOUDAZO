"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, User as UserIcon, Save, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/lib/auth";
import { getProfile, saveProfile } from "@/lib/session";
import { listCourses } from "@/lib/api";
import type { Register } from "@/lib/types";

const REGISTERS: { key: Register; label: string }[] = [
  { key: "formal", label: "Formal" },
  { key: "coursemate", label: "Coursemate" },
  { key: "pidgin", label: "Pidgin-inflected" },
];

export default function ProfilePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [register, setRegister] = useState<Register>("coursemate");
  const [saving, setSaving] = useState(false);
  const [courseCount, setCourseCount] = useState<number | null>(null);

  useEffect(() => {
    const profile = getProfile();
    if (profile) {
      setName(profile.name);
      setRegister(profile.register);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    listCourses()
      .then((courses) => setCourseCount(courses.length))
      .catch(() => setCourseCount(null));
  }, [authLoading, user]);

  function handleSave() {
    setSaving(true);
    saveProfile({ name: name.trim(), register });
    push("Profile updated");
    setSaving(false);
  }

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">Profile</span>
        <h1 className="mt-2 font-display text-2xl text-paper sm:text-3xl">Your details</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy font-display text-xl text-white">
              {(name || "S").trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-display text-lg text-paper">{name || "Add your name"}</p>
              <p className="text-sm text-paper-faint">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-paper-dim">Display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-faint focus-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-paper-dim">
                How the AI tutor should explain things
              </label>
              <div className="flex flex-wrap gap-2">
                {REGISTERS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRegister(r.key)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-ring ${
                      register === r.key
                        ? "border-navy bg-navy text-white"
                        : "border-ink-border text-paper-dim hover:border-navy/40"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} loading={saving}>
                <Save size={14} /> Save changes
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-accent/10 text-ai-accent">
                <BookOpen size={17} />
              </span>
              <div>
                {courseCount === null ? (
                  <Spinner label="" />
                ) : (
                  <p className="font-display text-2xl text-paper">{courseCount}</p>
                )}
                <p className="text-xs text-paper-faint">
                  {courseCount === 1 ? "course" : "courses"} added
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-navy">
                <UserIcon size={17} />
              </span>
              <div>
                <p className="text-sm text-paper">Dark mode & exam mode</p>
                <p className="text-xs text-paper-faint">Open via the account menu, top right</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-achievement/10 text-achievement">
                  <PlayCircle size={17} />
                </span>
                <div>
                  <p className="text-sm text-paper">Replay walkthrough</p>
                  <p className="text-xs text-paper-faint">Re-run the guided tour of the app</p>
                </div>
              </div>
              <Link href="/dashboard?tour=1">
                <Button size="sm" variant="outline">
                  Replay
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
