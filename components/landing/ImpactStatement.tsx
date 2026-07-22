"use client";

import { motion } from "framer-motion";

export function ImpactStatement() {
  return (
    <section className="relative overflow-hidden bg-navy px-6 py-32">
      <div className="pointer-events-none absolute inset-0 grain-overlay opacity-[0.08]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gold/10 blur-[160px]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-white/50"
        >
          The problem with most revision
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-balance font-display text-4xl leading-[1.15] text-white sm:text-5xl lg:text-6xl"
        >
          You re-read everything equally.
          <br />
          <span className="italic text-gold">Your exam doesn&apos;t.</span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-3"
        >
          <Stat text="Some topics" label="come back in your lecturer's past questions, year after year" />
          <Stat text="Some" label="show up once and never again" />
          <Stat text="Only Spoudazõ" label="counts which is which, from your own course's actual past papers" />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ text, label }: { text: string; label: string }) {
  return (
    <div>
      <span className="font-display text-2xl text-gold sm:text-3xl">{text}</span>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{label}</p>
    </div>
  );
}
