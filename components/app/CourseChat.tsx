"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, BookOpen, Download } from "lucide-react";
import { ChatMessageList } from "@/components/app/ChatMessages";
import { QuickSuggestions } from "@/components/app/QuickSuggestions";
import { useCourseChat } from "@/lib/useCourseChat";

const SUGGESTIONS = [
  "Summarize this week's topics",
  "Quiz me on the last chapter",
  "What am I weakest on?",
];

/**
 * CourseChat - floating "ask about your notes" widget, scoped to one
 * course. State/send logic lives in useCourseChat (also used by the Smart
 * Library reader's docked AI panel) so both surfaces share one
 * implementation instead of drifting apart.
 */
export function CourseChat({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, sending, send, regenerate, exportMarkdown } = useCourseChat(courseId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Auto-grow the textarea up to a small cap instead of staying a fixed
  // single row - keeps short questions compact but multi-line ones legible.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

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
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#2B2B2B] shadow-gold-lg transition-transform hover:scale-105 focus-ring lg:bottom-6 lg:right-6"
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
            className="fixed bottom-20 right-4 left-4 z-40 flex h-[min(28rem,65vh)] flex-col overflow-hidden rounded-2xl border border-gold/20 bg-ink-surface shadow-2xl lg:left-auto lg:right-6 lg:bottom-6 lg:h-[32rem] lg:w-[23rem]"
          >
            <div className="flex items-center justify-between border-b border-ink-border bg-ink px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
                  <MessageCircle size={16} />
                </span>
                <div>
                  <p className="font-display text-sm text-paper">Ask about your notes</p>
                  <p className="text-xs text-paper-faint">Your notes, the web, or general knowledge — labeled either way</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => exportMarkdown("Chat")}
                    aria-label="Export conversation"
                    title="Export as Markdown"
                    className="rounded-full p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
                  >
                    <Download size={15} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <ChatMessageList
                messages={messages}
                sending={sending}
                onRegenerate={regenerate}
                emptyState={
                  <div className="flex h-full flex-col items-center justify-center text-center text-paper-faint">
                    <BookOpen size={28} className="mb-2 text-gold-deep/70" />
                    <p className="text-sm">
                      Hey! Ask me anything about the material you&apos;ve uploaded — I&apos;m
                      happy to walk through it with you.
                    </p>
                    <QuickSuggestions suggestions={SUGGESTIONS} onPick={(s) => send(s)} />
                  </div>
                }
              />
            </div>

            <div className="border-t border-ink-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Explain Euler's Method from my notes"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-ink-border bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-paper-faint focus-ring"
                />
                <button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-[#2B2B2B] transition-all hover:bg-gold-deep disabled:opacity-40 focus-ring"
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
