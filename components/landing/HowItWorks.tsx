"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Upload your materials",
    body: "Lecture PDFs, textbook chapters, past questions — drop them into a course and Spoudazõ chunks, embeds, and indexes them for retrieval.",
  },
  {
    n: "02",
    title: "Topics get mined, not guessed",
    body: "A frequency pass counts which topics recur across your uploaded past questions. The count is deterministic — the model only narrates what was already tallied.",
  },
  {
    n: "03",
    title: "Practice against the real thing",
    body: "Theory questions come with a point-by-point rubric; CBT questions are grounded in your own course library, not invented from thin air.",
  },
  {
    n: "04",
    title: "See exactly where you're weak",
    body: "Every attempt updates a per-topic mastery score, so your next revision session starts on what you actually got wrong.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 max-w-xl"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-ai-accent">
            The pipeline
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            Four steps, in this order, every time.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-ink-border bg-ink-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-ink-soft p-7"
            >
              <span className="font-mono text-sm text-paper-faint">{step.n}</span>
              <h3 className="mt-4 font-display text-lg text-paper">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper-dim">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}