"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#dashboard-preview", label: "Dashboard" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  // Close the mobile menu on any scroll so it never lingers over new content.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-x-0 top-0 z-40"
    >
      <nav
        className={clsx(
          "mx-auto flex max-w-6xl items-center justify-between border-b transition-all duration-300",
          scrolled
            ? "px-4 py-3 border-ink-border/70 bg-ink/80 backdrop-blur-md sm:px-6"
            : "px-4 py-5 border-transparent bg-transparent sm:px-6"
        )}
      >
        <Link href="/" className="font-display text-xl italic text-paper">
          Spoudazõ
        </Link>
        <div className="hidden items-center gap-8 text-sm text-paper-dim md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="relative transition-colors hover:text-paper">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-paper-dim transition-colors hover:text-paper sm:inline"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-full bg-gold px-4 py-2 text-sm font-semibold text-[#2B2B2B] transition-all hover:bg-gold-deep hover:shadow-gold sm:px-5 sm:py-2.5"
          >
            <span className="relative">Start studying</span>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-border text-paper-dim focus-ring md:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-ink-border/70 bg-ink/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3 text-sm text-paper-dim">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-2.5 transition-colors hover:bg-ink-surface hover:text-paper"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 transition-colors hover:bg-ink-surface hover:text-paper"
              >
                Log in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
