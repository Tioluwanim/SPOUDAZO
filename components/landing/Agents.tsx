"use client";

import { motion } from "framer-motion";
import { GraduationCap, Target, CalendarClock, Library } from "lucide-react";

const AGENTS = [
  {
    icon: GraduationCap,
    name: "Tutor",
    role: "Explains, in your register",
    body: "Answers questions against your own uploaded materials, with citations back to the source chunk — and talks the way you asked it to at onboarding: formal, like a coursemate, or Pidgin-inflected.",
  },
  {
    icon: Target,
    name: "Exam Coach",
    role: "Runs the drills",
    body: "Generates theory and CBT questions grounded in your library, grades against a real rubric point-by-point, and tells you which specific part of your answer was missing.",
  },
  {
    icon: CalendarClock,
    name: "Planner",
    role: "Sequences your revision",
    body: "Takes your weak-area ranking and turns it into a study order — highest-frequency, lowest-mastery topics first.",
  },
  {
    icon: Library,
    name: "Library",
    role: "Keeps everything retrievable",
    body: "Hybrid search over your course — keyword and semantic together, re-ranked for relevance — so answers stay grounded instead of hallucinated.",
  },
];

export function Agents() {
  return (
    <section id="agents" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 max-w-xl"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-success">
            Under the hood
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            Four agents, each doing one job.
          </h2>
          <p className="mt-4 text-paper-dim">
            No single model pretending to do everything. Each agent has a
            narrow, checkable job, and a deterministic core underneath it
            wherever accuracy matters more than fluency.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group rounded-2xl border border-ink-border bg-ink-surface/60 p-7 transition-colors hover:border-ai-accent/40"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai-accent/10 text-ai-accent">
                  <agent.icon size={19} />
                </div>
                <div>
                  <h3 className="font-display text-lg text-paper">{agent.name}</h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-paper-faint">
                    {agent.role}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-paper-dim">{agent.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}