"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

const REGISTERS = [
  {
    key: "formal",
    label: "Formal",
    sample:
      "A perceptron converges only when the training data is linearly separable; otherwise, the weight updates will oscillate indefinitely.",
  },
  {
    key: "coursemate",
    label: "Coursemate",
    sample:
      "Basically — perceptron only 'settles' if you can draw a straight line to separate the classes. If not, it'll just keep adjusting weights forever, never landing.",
  },
  {
    key: "pidgin",
    label: "Pidgin-inflected",
    sample:
      "E be like say if your data no fit separate with one straight line, the perceptron no go ever rest — e go just dey adjust the weights forever.",
  },
] as const;

export function RegisterShowcase() {
  const [active, setActive] = useState<(typeof REGISTERS)[number]["key"]>("coursemate");
  const current = REGISTERS.find((r) => r.key === active)!;

  return (
    <section id="for-oau" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-mono text-xs uppercase tracking-widest text-amber-glow">
            Built for OAU, not translated for it
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            It explains things the way your coursemate would.
          </h2>
          <p className="mt-4 max-w-md text-paper-dim">
            At onboarding, you pick how the Tutor should talk to you. Same
            explanation, same source material, different register — because
            the point is understanding, not sounding like a textbook.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {REGISTERS.map((r) => (
              <button
                key={r.key}
                onClick={() => setActive(r.key)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm transition-colors focus-ring",
                  active === r.key
                    ? "border-amber-glow bg-amber-glow/10 text-amber-glow"
                    : "border-ink-border text-paper-dim hover:border-paper-faint"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-ink-border bg-ink-surface/70 p-8"
        >
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-paper-faint">
            Tutor · CPE 316 · perceptron convergence
          </p>
          <motion.p
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-lg leading-relaxed text-paper"
          >
            {current.sample}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
