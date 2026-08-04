"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "Does it work if my lecturer never releases past questions?",
    a: "The frequency scan needs at least a few years of past questions to count from. Without them, Spoudazõ still works as a tutor and library over your uploaded materials — you just lose the ranked topic list until past questions are added.",
  },
  {
    q: "Is the frequency count guessed by the AI, or actually counted?",
    a: "Counted. A deterministic pass tallies how often each topic recurs across your uploaded past questions before any model is involved — the AI narrates the count, it doesn't invent it.",
  },
  {
    q: "Which courses is this built for right now?",
    a: "The pilot is scoped to OAU courses with a Computer Engineering / Electronic Engineering focus, since that's where the past-question library is deepest. You can upload materials for any course — coverage quality varies until more students seed a course's library.",
  },
  {
    q: "Can the Tutor explain in Pidgin or a more casual register?",
    a: "Yes — you choose the register at onboarding: formal, coursemate, or Pidgin-inflected. Same source material and citations either way, just a different explanation style.",
  },
  {
    q: "What happens to my uploaded course materials?",
    a: "They're chunked and embedded for retrieval within your own account and used to ground answers and generated questions. They aren't used to train a shared model.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
            Questions
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            Before you upload your first course.
          </h2>
        </motion.div>

        <div className="divide-y divide-ink-border rounded-2xl border border-ink-border bg-ink-surface/50">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-ring"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base text-paper sm:text-lg">{item.q}</span>
                  <Plus
                    size={18}
                    className={`shrink-0 text-gold-deep transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm leading-relaxed text-paper-dim">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
