"use client";

import { motion } from "framer-motion";
import { BookOpen, Globe2, Sparkles } from "lucide-react";
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
}: {
  messages: DisplayMessage[];
  sending: boolean;
  emptyState: React.ReactNode;
}) {
  if (messages.length === 0 && !sending) return <>{emptyState}</>;

  return (
    <>
      {messages.map((m, i) => {
        const badge = m.grounding ? GROUNDING_BADGE[m.grounding] : null;
        const BadgeIcon = badge?.icon;
        return (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div
                className={`rounded-xl px-3.5 py-2.5 ${
                  m.role === "user"
                    ? "bg-ai-accent text-sm leading-relaxed text-white"
                    : "border border-ink-border bg-ink"
                }`}
              >
                {m.role === "user" ? m.content : <MarkdownMessage content={m.content} />}
              </div>
              {m.mermaid && (
                <div className="mt-2">
                  <MermaidDiagram chart={m.mermaid} />
                </div>
              )}
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
                <p className="mt-1 text-[11px] text-paper-faint">Sources: {m.sources.join(", ")}</p>
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
