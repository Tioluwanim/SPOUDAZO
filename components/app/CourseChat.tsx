"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, BookOpen } from "lucide-react";
import { ChatMessageList } from "@/components/app/ChatMessages";
import { useCourseChat } from "@/lib/useCourseChat";

/**
 * CourseChat - floating "ask about your notes" widget, scoped to one
 * course. State/send logic lives in useCourseChat (also used by the Smart
 * Library reader's docked AI panel) so both surfaces share one
 * implementation instead of drifting apart.
 */
export function CourseChat({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, sending, send } = useCourseChat(courseId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask about your notes"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ai-accent text-white shadow-lg shadow-ai-accent/40 transition-transform hover:scale-105 focus-ring sm:bottom-6 sm:right-6"
        style={{ display: open ? "none" : "flex" }}
      >
        <MessageCircle size={24} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 left-4 z-40 flex h-[min(32rem,75vh)] flex-col overflow-hidden rounded-2xl border border-ink-border bg-ink-surface shadow-2xl sm:left-auto sm:right-6 sm:bottom-6 sm:h-[32rem] sm:w-[23rem]"
          >
            <div className="flex items-center justify-between border-b border-ink-border bg-ink px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ai-accent/15 text-ai-accent">
                  <MessageCircle size={16} />
                </span>
                <div>
                  <p className="font-display text-sm text-paper">Ask about your notes</p>
                  <p className="text-xs text-paper-faint">Your notes, the web, or general knowledge — labeled either way</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <ChatMessageList
                messages={messages}
                sending={sending}
                emptyState={
                  <div className="flex h-full flex-col items-center justify-center text-center text-paper-faint">
                    <BookOpen size={28} className="mb-2 text-ai-accent/60" />
                    <p className="text-sm">
                      Hey! Ask me anything about the material you&apos;ve uploaded — I&apos;m
                      happy to walk through it with you.
                    </p>
                  </div>
                }
              />
            </div>

            <div className="border-t border-ink-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Explain Euler's Method from my notes"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-ink-border bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-paper-faint focus-ring"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-accent text-white transition-opacity hover:bg-ai-accent-deep disabled:opacity-40 focus-ring"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
