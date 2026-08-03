"use client";

import { useState } from "react";
import { streamCourseChat } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ChatTurn } from "@/lib/types";

export interface DisplayMessage extends ChatTurn {
  grounding?: "notes" | "notes+web" | "web" | "general";
  sources?: string[];
  mermaid?: string;
}

/**
 * Chat state + send logic for the course-wide "ask about your notes"
 * assistant - shared by the floating widget (CourseChat) and the Smart
 * Library reader's docked AI panel, so there's one place that owns
 * message state, the optimistic-update/rollback behavior, and the error
 * toast, instead of two copies drifting apart.
 *
 * History lives only in component state (not persisted server-side, per
 * app/agents/notes_chat.py) - resets on refresh, same limitation in both
 * call sites.
 *
 * `currentDocId`/`currentSectionIndex` are the reader's "what's on screen
 * right now" - passed through to the backend's AI Context Service (see
 * app/services/ai_context_service.py) so the assistant already knows
 * without the student stating it. The floating widget (outside the
 * reader) simply doesn't pass these; the backend then falls back to the
 * user's most recently read document in this course automatically.
 */
export function useCourseChat(
  courseId: number,
  currentDocId?: string,
  currentSectionIndex?: number
) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  async function send() {
    const message = input.trim();
    if (!message || sending) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    // Placeholder assistant message that fills in as tokens arrive -
    // this is what makes streaming visible instead of just an
    // implementation detail with the same perceived wait as before.
    let streamedIndex = -1;
    setMessages((prev) => {
      streamedIndex = prev.length;
      return [...prev, { role: "assistant", content: "" }];
    });

    try {
      const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
      let accumulated = "";

      await streamCourseChat(
        courseId,
        message,
        history,
        {
          onMeta: (meta) => {
            setMessages((prev) =>
              prev.map((m, i) => (i === streamedIndex ? { ...m, grounding: meta.grounding, sources: meta.sources } : m))
            );
          },
          onToken: (text) => {
            accumulated += text;
            setMessages((prev) =>
              prev.map((m, i) => (i === streamedIndex ? { ...m, content: accumulated } : m))
            );
          },
          onError: (errMessage) => {
            throw new Error(errMessage);
          },
        },
        currentDocId,
        currentSectionIndex
      );
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't reach the study assistant", "error");
      setMessages(messages); // roll back both the optimistic user message and the streaming placeholder
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  /** Pushes a message pair straight into the feed without calling the chat
   * API - used by the reader's highlight-to-ask toolbar, whose actions
   * (explain, summarize, ...) hit their own endpoint and just need the
   * result to land in the same panel the student is already looking at,
   * instead of a separate popup. */
  function addAssistantMessage(userLabel: string, assistantContent: string, mermaid?: string) {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userLabel },
      { role: "assistant", content: assistantContent, mermaid },
    ]);
  }

  return { messages, input, setInput, sending, send, addAssistantMessage };
}

export type CourseChatState = ReturnType<typeof useCourseChat>;
