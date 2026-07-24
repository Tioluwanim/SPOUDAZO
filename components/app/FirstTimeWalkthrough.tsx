"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Sparkles,
  BookOpen,
  BarChart3,
  CalendarDays,
  MessageCircle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "spoudazo:walkthrough_seen";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Upload,
    title: "Upload your materials",
    body: "Lecture notes, slides, past questions - drop them into a course. Spoudazõ reads them so you don't have to guess what's actually important.",
  },
  {
    icon: Sparkles,
    title: "We find what repeats",
    body: "Your material gets scanned for the topics your lecturer keeps coming back to - not a generic syllabus summary, the actual pattern in your own course.",
  },
  {
    icon: BookOpen,
    title: "Practice, both ways",
    body: "Theory questions graded point-by-point against a rubric, or CBT multiple-choice with instant explanations - both grounded in your own notes.",
  },
  {
    icon: BarChart3,
    title: "See your weak spots",
    body: "Every attempt updates your mastery per topic, so Weak Areas always shows exactly where to focus next - not just what you feel unsure about.",
  },
  {
    icon: CalendarDays,
    title: "Get a revision plan",
    body: "Tell us your exam date and hours available. We schedule your weakest topics first, with links straight into practice.",
  },
  {
    icon: MessageCircle,
    title: "Ask anytime",
    body: "The floating chat in every course answers questions grounded in your own material - open it whenever you get stuck on a topic.",
  },
];

export function hasSeenWalkthrough(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function markWalkthroughSeen() {
  window.localStorage.setItem(STORAGE_KEY, "1");
}

export function FirstTimeWalkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  function finish() {
    markWalkthroughSeen();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-ink-border bg-ink-soft shadow-2xl"
      >
        <div className="relative flex h-40 items-center justify-center bg-navy">
          <div className="pointer-events-none absolute inset-0 grain-overlay opacity-10" />
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.35 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-achievement/15 text-achievement"
            >
              <Icon size={28} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="mb-2 font-display text-xl text-paper">{current.title}</h3>
              <p className="text-sm leading-relaxed text-paper-dim">{current.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "h-1.5 w-5 rounded-full bg-ai-accent transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-ink-border transition-all"
                }
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={finish}
              className="text-sm text-paper-faint transition-colors hover:text-paper-dim focus-ring"
            >
              Skip
            </button>
            <Button onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
              {isLast ? "Get started" : "Next"}
              {!isLast && <ArrowRight size={15} />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}