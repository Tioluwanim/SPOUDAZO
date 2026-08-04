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
    <section id="features" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 max-w-xl"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
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
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-ink-border bg-ink-surface/60 p-7 shadow-sm transition-all hover:border-gold/40 hover:shadow-gold"
            >
              {/* Soft gold glow that only appears on hover - premium, not loud */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/0 blur-3xl transition-colors duration-500 group-hover:bg-gold/15" />

              <div className="relative mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 text-gold-deep transition-transform duration-300 group-hover:scale-110">
                  <agent.icon size={20} />
                </div>
                <div>
                  <h3 className="font-display text-lg text-paper">{agent.name}</h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-paper-faint">
                    {agent.role}
                  </p>
                </div>
              </div>
              <p className="relative text-sm leading-relaxed text-paper-dim">{agent.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
