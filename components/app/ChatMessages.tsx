"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Globe2, Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { MermaidDiagram } from "@/components/app/MermaidDiagram";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import type { DisplayMessage } from "@/lib/useCourseChat";

const GROUNDING_BADGE: Record<
  NonNullable<DisplayMessage["grounding"]>,
  { label: string; icon: typeof BookOpen }
> = {
  notes: { label: "From your notes", icon: BookOpen },
  "notes+web": { label: "Your notes + web", icon: Globe2 },
  web: { label: "Web resources — not in your notes", icon: Globe2 },
  general: { label: "General knowledge — not in your notes", icon: Sparkles },
};

export function ChatMessageList({
  messages,
  sending,
  emptyState,
  onRegenerate,
}: {
  messages: DisplayMessage[];
  sending: boolean;
  emptyState: React.ReactNode;
  /** Optional - when provided, a regenerate action appears under the most
   * recent assistant reply. Omitted call sites (e.g. read-only transcripts)
   * simply don't get the action. */
  onRegenerate?: () => void;
}) {
  if (messages.length === 0 && !sending) return <>{emptyState}</>;

  const lastAssistantIndex = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return (
    <>
      {messages.map((m, i) => {
        const badge = m.grounding ? GROUNDING_BADGE[m.grounding] : null;
        const BadgeIcon = badge?.icon;
        const isStreamingThis = sending && i === messages.length - 1 && m.role === "assistant";
        const isLastAssistant = m.role === "assistant" && i === lastAssistantIndex;

        return (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="group max-w-[85%]">
              <div className="flex items-end gap-2">
                {m.role === "assistant" && (
                  <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
                    <Sparkles size={12} />
                  </span>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 ${
                    m.role === "user"
                      ? "rounded-br-md bg-gold text-sm leading-relaxed text-[#2B2B2B] shadow-sm"
                      : "rounded-bl-md border border-ink-border bg-ink-soft"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <>
                      <MarkdownMessage content={m.content} />
                      {isStreamingThis && (
                        <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-gold-deep align-text-bottom" />
                      )}
                    </>
                  )}
                </div>
              </div>

              {m.mermaid && (
                <div className="mt-2 ml-8">
                  <MermaidDiagram chart={m.mermaid} />
                </div>
              )}

              {badge && BadgeIcon && (
                <div
                  className={`ml-8 mt-1.5 flex items-center gap-1 text-[11px] ${
                    m.grounding === "notes" ? "text-success" : "text-gold-deep"
                  }`}
                >
                  <BadgeIcon size={11} />
                  {badge.label}
                </div>
              )}
              {m.sources && m.sources.length > 0 && (
                <p className="ml-8 mt-1 text-[11px] text-paper-faint">Sources: {m.sources.join(", ")}</p>
              )}

              {m.role === "assistant" && m.content && !isStreamingThis && (
                <div className="ml-8 mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyButton text={m.content} />
                  {isLastAssistant && onRegenerate && (
                    <button
                      onClick={onRegenerate}
                      disabled={sending}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-paper-faint transition-colors hover:bg-ink-border hover:text-paper disabled:opacity-40 focus-ring"
                    >
                      <RefreshCw size={11} />
                      Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {sending && messages[messages.length - 1]?.content === "" && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-ink-border bg-ink-soft px-3.5 py-2.5">
            <Dot />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </div>
        </div>
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable - fail silently, the
      // button just won't show the "copied" state.
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-paper-faint transition-colors hover:bg-ink-border hover:text-paper focus-ring"
    >
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-gold-deep"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}
