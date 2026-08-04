"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

// Placeholder quotes - written to sound like real OAU students but not
// attributed to anyone real. Swap these for actual pilot-user quotes
// before this goes live; fabricated testimonials with real names/photos
// would be misleading.
const QUOTES = [
  {
    initials: "T.A.",
    dept: "Computer Engineering, 300L",
    quote:
      "I stopped re-reading my whole course note the night before. The frequency count told me exactly which four topics to actually worry about.",
  },
  {
    initials: "F.O.",
    dept: "Electronic Engineering, 400L",
    quote:
      "The rubric grading on theory questions is the part I didn't expect to need. It tells you the specific line you left out, not just a score.",
  },
  {
    initials: "B.K.",
    dept: "Computer Science, 200L",
    quote:
      "Asked the tutor in Pidgin during a late-night session and it actually explained convergence properly. Didn't feel like talking to a textbook.",
  },
];

export function Testimonials() {
  return (
    <section className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-xl"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
            From the pilot
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            What early students say.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {QUOTES.map((q, i) => (
            <motion.div
              key={q.initials}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col rounded-2xl border border-ink-border bg-ink-surface/60 p-7 shadow-sm"
            >
              <Quote size={20} className="mb-4 text-gold/60" />
              <p className="flex-1 text-sm leading-relaxed text-paper">{q.quote}</p>
              <div className="mt-6 flex items-center gap-3 border-t border-ink-border pt-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 font-mono text-xs text-gold-deep">
                  {q.initials}
                </span>
                <span className="text-xs text-paper-faint">{q.dept}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
