"use client";

import { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen, Send, Sparkles, Download } from "lucide-react";
import { ChatMessageList } from "@/components/app/ChatMessages";
import { QuickSuggestions } from "@/components/app/QuickSuggestions";
import type { CourseChatState } from "@/lib/useCourseChat";

const MIN_WIDTH = 280;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 360;

const SUGGESTIONS = [
  "Explain this page",
  "Summarize the key points",
  "Quiz me on this section",
];

/**
 * Docked AI panel for the reader. Takes `chat` as a prop (rather than
 * calling useCourseChat itself) so the reader page can share ONE chat
 * instance between this panel and the highlight-to-ask toolbar -
 * pushing a toolbar result into the panel means they have to be the
 * same state, not two independent copies.
 */
export function AIAssistantPanel({ chat }: { chat: CourseChatState }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const { messages, input, setInput, sending, send, regenerate, exportMarkdown } = chat;
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!resizingRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(next);
    }
    function onPointerUp() {
      resizingRef.current = false;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (collapsed) {
    return (
      <div className="hidden shrink-0 border-l border-ink-border bg-ink-surface/40 lg:flex lg:flex-col lg:items-center lg:py-4">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Open AI panel"
          className="rounded-lg p-2 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative hidden shrink-0 flex-col border-l border-ink-border bg-ink-surface/40 lg:flex"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={(e) => {
          resizingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"
      />

      <div className="flex items-center justify-between border-b border-ink-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
            <Sparkles size={14} />
          </span>
          <p className="font-display text-sm text-paper">Study assistant</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => exportMarkdown("Study session")}
              aria-label="Export conversation"
              title="Export as Markdown"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse AI panel"
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
          >
            <PanelRightClose size={16} />
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
              <Sparkles size={26} className="mb-2 text-gold-deep/70" />
              <p className="text-sm">Ask about anything on this page, or your course material in general.</p>
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
            placeholder="Ask a question…"
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
    </div>
  );
}
