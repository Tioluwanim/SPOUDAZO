"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { saveProfile } from "@/lib/session";
import { useRequireAuth } from "@/lib/auth";
import { createCourse } from "@/lib/api";
import type { Register } from "@/lib/types";

const REGISTERS: { key: Register; label: string; blurb: string }[] = [
  { key: "formal", label: "Formal", blurb: "Precise, textbook-style explanations." },
  { key: "coursemate", label: "Coursemate", blurb: "Relaxed, like a study partner explaining it." },
  { key: "pidgin", label: "Pidgin-inflected", blurb: "Naija Pidgin flavour mixed into the explanation." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { push } = useToast();
  const { user, loading } = useRequireAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [register, setRegister] = useState<Register>("coursemate");
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function finish() {
    if (!courseName.trim() || !courseCode.trim()) return;
    setSubmitting(true);
    try {
      const profile = saveProfile({ name: name.trim(), register, onboarded: true });
      const course = await createCourse(courseName.trim(), courseCode.trim().toUpperCase());
      push(`Welcome, ${profile.name || "there"} — ${course.code} is ready`);
      router.push(`/courses/${course.id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't reach the server", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  const steps = [
    {
      valid: name.trim().length > 0,
      render: () => (
        <>
          <StepHeading eyebrow="1 of 3" title="What should we call you?" />
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(1)}
            placeholder="Your name"
            className="w-full rounded-xl border border-ink-border bg-ink-surface px-5 py-3.5 text-lg text-paper placeholder:text-paper-faint focus-ring"
          />
        </>
      ),
    },
    {
      valid: true,
      render: () => (
        <>
          <StepHeading
            eyebrow="2 of 3"
            title="How should the Tutor explain things to you?"
          />
          <div className="space-y-3">
            {REGISTERS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRegister(r.key)}
                className={clsx(
                  "flex w-full flex-col rounded-xl border px-5 py-4 text-left transition-colors focus-ring",
                  register === r.key
                    ? "border-amber-glow bg-amber-glow/10"
                    : "border-ink-border hover:border-paper-faint"
                )}
              >
                <span className="font-medium text-paper">{r.label}</span>
                <span className="mt-1 text-sm text-paper-dim">{r.blurb}</span>
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      valid: courseName.trim().length > 0 && courseCode.trim().length > 0,
      render: () => (
        <>
          <StepHeading eyebrow="3 of 3" title="Set up your first course" />
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-paper-dim">Course code</label>
              <input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="CPE 316"
                className="w-full rounded-xl border border-ink-border bg-ink-surface px-5 py-3.5 text-paper placeholder:text-paper-faint focus-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-paper-dim">Course name</label>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Artificial Intelligence"
                className="w-full rounded-xl border border-ink-border bg-ink-surface px-5 py-3.5 text-paper placeholder:text-paper-faint focus-ring"
              />
            </div>
          </div>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={clsx(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-amber-glow" : "bg-ink-border"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {current.render()}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={15} /> Back
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            disabled={!current.valid}
            loading={isLast && submitting}
          >
            {isLast ? "Create course & start" : "Continue"}
            {!isLast && <ArrowRight size={15} />}
          </Button>
        </div>
      </div>
    </main>
  );
}

function StepHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="font-mono text-xs uppercase tracking-widest text-amber-glow">
        {eyebrow}
      </span>
      <h1 className="mt-2 font-display text-2xl text-paper">{title}</h1>
    </div>
  );
}
