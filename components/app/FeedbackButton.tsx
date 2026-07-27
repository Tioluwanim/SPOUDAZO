"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, Lightbulb, MessageCircle, X as XIcon } from "lucide-react";
import { FeedbackModal } from "@/components/app/FeedbackModal";
import { initFeedbackContextCapture } from "@/lib/feedbackContext";
import type { FeedbackCategory } from "@/lib/types";

const QUICK_OPTIONS: { category: FeedbackCategory; label: string; icon: typeof Bug }[] = [
  { category: "bug", label: "Report Bug", icon: Bug },
  { category: "feature", label: "Suggest Feature", icon: Lightbulb },
  { category: "other", label: "Feedback", icon: MessageCircle },
];

export function FeedbackButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<FeedbackCategory>("bug");

  useEffect(() => {
    initFeedbackContextCapture();
  }, []);

  function openModal(category: FeedbackCategory) {
    setInitialCategory(category);
    setMenuOpen(false);
    setModalOpen(true);
  }

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="mb-3 flex flex-col items-end gap-2"
            >
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.category}
                  onClick={() => openModal(opt.category)}
                  className="flex items-center gap-2 rounded-full border border-ink-border bg-ink-surface px-4 py-2.5 text-sm text-paper shadow-lg backdrop-blur-md transition-transform hover:scale-[1.03] focus-ring"
                >
                  <opt.icon size={16} className="text-ai-accent" />
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close feedback menu" : "Send feedback"}
          data-tour="feedback-button"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-glow transition-transform hover:scale-105 focus-ring active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            {menuOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <XIcon size={22} />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ rotate: 45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -45, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MessageCircle size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <FeedbackModal open={modalOpen} onClose={() => setModalOpen(false)} initialCategory={initialCategory} />
    </>
  );
}
