"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github, Linkedin } from "lucide-react";
import { FrequencyPulse } from "./FrequencyPulse";

export function ClosingCTA() {
  return (
    <section className="relative overflow-hidden border-t border-ink-border px-6 py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[160px]" />
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
          className="group relative overflow-hidden mt-9 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 font-semibold text-[#2B2B2B] transition-all hover:bg-gold-deep hover:shadow-gold-lg"
        >
          Get started free
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}

const FOOTER_LINKS = {
  Product: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Dashboard", href: "#dashboard-preview" },
    { label: "Pricing", href: "/signup" },
  ],
  Resources: [
    { label: "FAQ", href: "#faq" },
    { label: "Documentation", href: "/docs" },
    { label: "Built for OAU", href: "#for-oau" },
  ],
  Company: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "mailto:hello@spoudazo.app" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="border-t border-ink-border px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span className="font-display text-xl italic text-paper">Spoudazõ</span>
            <p className="mt-3 max-w-[22ch] text-sm leading-relaxed text-paper-faint">
              Built by students, for students, at Obafemi Awolowo University.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-border text-paper-dim transition-colors hover:border-gold hover:text-gold-deep focus-ring"
              >
                <Github size={16} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-border text-paper-dim transition-colors hover:border-gold hover:text-gold-deep focus-ring"
              >
                <Linkedin size={16} />
              </a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                {heading}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-paper-dim transition-colors hover:text-gold-deep"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-ink-border pt-8 text-xs text-paper-faint sm:flex-row">
          <span>© {new Date().getFullYear()} Spoudazõ. All rights reserved.</span>
          <span>Made in Ile-Ife, Nigeria.</span>
        </div>
      </div>
    </footer>
  );
}
