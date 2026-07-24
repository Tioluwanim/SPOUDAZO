"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, BookOpen, Globe2, Sparkles } from "lucide-react";
import { sendCourseChat } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ChatTurn } from "@/lib/types";

interface DisplayMessage extends ChatTurn {
  grounding?: "notes" | "notes+web" | "web" | "general";
  sources?: string[];
}

const GROUNDING_BADGE: Record<
  NonNullable<DisplayMessage["grounding"]>,
  { label: string; icon: typeof BookOpen }
> = {
  notes: { label: "From your notes", icon: BookOpen },
  "notes+web": { label: "Your notes + web", icon: Globe2 },
  web: { label: "Web resources — not in your notes", icon: Globe2 },
  general: { label: "General knowledge — not in your notes", icon: Sparkles },
};

/**
 * CourseChat - floating "ask about your notes" widget, scoped to one
 * course. Chat history lives only in this component's state - it does
 * not persist server-side (see app/agents/notes_chat.py), so it resets
 * on refresh. Good enough for "ask a question while studying"; revisit
 * if students want their chat history to survive a reload.
 *
 * Every assistant message carries a grounding badge - see
 * app/agents/notes_chat.py for why this matters: the chatbot can now
 * answer from cached web resources or general knowledge when the
 * student's own notes don't cover something, and the badge is what
 * keeps that transparent instead of blurring "from your material" with
 * "the model is guessing."
 */
export function CourseChat({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { push } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const message = input.trim();
    if (!message || sending) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      // Only role+content go to the backend as history - grounding/sources
      // are display-only annotations added after each response.
      const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
      const result = await sendCourseChat(courseId, message, history);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.answer, grounding: result.grounding, sources: result.sources },
      ]);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't reach the study assistant", "error");
      setMessages(messages); // roll back the optimistic user message on failure
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-paper-faint">
                  <BookOpen size={28} className="mb-2 text-ai-accent/60" />
                  <p className="text-sm">
                    Hey! Ask me anything about the material you&apos;ve uploaded — I&apos;m
                    happy to walk through it with you.
                  </p>
                </div>
              )}
              {messages.map((m, i) => {
                const badge = m.grounding ? GROUNDING_BADGE[m.grounding] : null;
                const BadgeIcon = badge?.icon;
                return (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%]">
                      <div
                        className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-ai-accent text-white"
                            : "border border-ink-border bg-ink text-paper"
                        }`}
                      >
                        {m.content}
                      </div>
                      {badge && BadgeIcon && (
                        <div
                          className={`mt-1.5 flex items-center gap-1 text-[11px] ${
                            m.grounding === "notes" ? "text-success" : "text-achievement"
                          }`}
                        >
                          <BadgeIcon size={11} />
                          {badge.label}
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <p className="mt-1 text-[11px] text-paper-faint">
                          Sources: {m.sources.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink px-3.5 py-2.5">
                    <Dot />
                    <Dot delay={0.15} />
                    <Dot delay={0.3} />
                  </div>
                </div>
              )}
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
                  onClick={handleSend}
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

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-paper-faint"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}