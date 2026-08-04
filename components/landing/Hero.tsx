"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { FrequencyPulse } from "./FrequencyPulse";

const TOPICS = [
  {
    label: "Neural network training",
    score: "appeared 6× in 5yrs",
    hot: true,
    answer:
      "Trained 6 times across your last 5 years of past questions. It's almost always paired with backpropagation — expect a derivation question, not just definitions.",
  },
  {
    label: "Àdáṣẹ / autonomous agents",
    score: "appeared 4× in 5yrs",
    hot: true,
    answer:
      "Shows up in 4 of the last 5 sittings, usually as a compare-and-contrast with reactive agents. Your lecturer favours diagram-based answers here.",
  },
  {
    label: "Perceptron convergence",
    score: "appeared 1× in 5yrs",
    hot: false,
    answer:
      "Only 1 appearance in 5 years — low priority. If you're short on time, this is one to skim rather than master.",
  },
];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const [active, setActive] = useState<number | null>(null);

  // Content fades/lifts out faster than the ambient backdrop as you scroll
  // past the hero - the separation in speed is what reads as depth rather
  // than everything moving together like a single flat layer.
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const backdropY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pt-24">
      {/* Ambient backdrop - moves slower than content on scroll */}
      <motion.div style={{ y: backdropY }} className="pointer-events-none absolute inset-0">
        <div className="grain-overlay absolute inset-0 opacity-40" />
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gold/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-success/10 blur-[120px]" />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs uppercase tracking-widest text-paper-dim"
          >
            <BookOpen size={13} className="text-gold-deep" />
            Built at Obafemi Awolowo University
          </motion.div>

          <h1 className="text-balance font-display text-5xl leading-[1.05] text-paper sm:text-6xl lg:text-[4.2rem]">
            {["Study what"].map((line, i) => (
              <RevealLine key={i} delay={0.05 + i * 0.08}>
                {line}
              </RevealLine>
            ))}
            <RevealLine delay={0.13}>
              <span className="italic text-gold-deep">actually shows up</span>
            </RevealLine>
            <RevealLine delay={0.21}>on the exam.</RevealLine>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.32 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-paper-dim"
          >
            Upload your course PDFs and past questions. Spoudazõ counts which
            topics your lecturers keep repeating, then builds your tutor
            sessions, CBT drills, and revision plan around exactly those —
            not a generic syllabus summary.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/signup"
              className="group relative overflow-hidden inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-semibold text-[#2B2B2B] transition-all hover:bg-gold-deep hover:shadow-gold-lg"
            >
              Start with your first course
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-gold/40 bg-ink-soft px-7 py-3.5 font-medium text-paper transition-colors hover:border-gold"
            >
              See how it works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mt-6 font-mono text-xs text-paper-faint"
          >
            No card required — your first course is free to try.
          </motion.p>
        </div>

        {/* Signature panel: a live "topic frequency" readout you can tap into */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative mx-auto w-full max-w-sm animate-floatSlow rounded-3xl border border-gold/20 bg-ink-surface/80 p-6 shadow-gold-lg backdrop-blur-md"
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
              CPE 316 · frequency scan
            </span>
            <span className="h-2 w-2 rounded-full bg-success" />
          </div>
          <FrequencyPulse className="h-24" />
          <div className="mt-5 space-y-1 border-t border-ink-border pt-4">
            {TOPICS.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActive(active === i ? null : i)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-gold/5 focus-ring"
              >
                <span className="text-paper-dim">{t.label}</span>
                <span className={t.hot ? "font-mono text-xs text-gold-deep" : "font-mono text-xs text-paper-faint"}>
                  {t.score}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {active !== null && (
              <motion.div
                key={active}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold/20 bg-gold/5 p-4">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-gold-deep" />
                  <p className="text-sm leading-relaxed text-paper">{TOPICS[active].answer}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-3 text-center font-mono text-[11px] text-paper-faint">
            Tap a topic — this is what the Tutor tells you.
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}

function RevealLine({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        className="block"
      >
        {children}
      </motion.span>
    </span>
  );
}
