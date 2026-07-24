"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FrequencyPulse } from "./FrequencyPulse";

export function ClosingCTA() {
  return (
    <section className="relative overflow-hidden border-t border-ink-border px-6 py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ai-accent/10 blur-[160px]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <FrequencyPulse className="mb-8 h-14 opacity-70" />
        <h2 className="text-balance font-display text-4xl text-paper sm:text-5xl">
          Your next exam has already been written once before.
        </h2>
        <p className="mt-5 max-w-xl text-paper-dim">
          Find out which parts of it repeat. Upload your first course
          material and let Spoudazõ show you the frequency count.
        </p>
        <Link
          href="/signup"
          className="group mt-9 inline-flex items-center gap-2 rounded-full bg-navy px-8 py-4 font-medium text-white transition-all hover:shadow-glow"
        >
          Get started free
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-ink-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-paper-faint sm:flex-row">
        <span className="font-display italic text-paper-dim">Spoudazõ</span>
        <span>Built by students, for students, at Obafemi Awolowo University.</span>
      </div>
    </footer>
  );
}