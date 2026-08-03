"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Copy,
  Highlighter,
  Languages,
  Lightbulb,
  ListChecks,
  ListTodo,
  GitBranch,
  Repeat2,
  ScrollText,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { createAnnotation, runTextAction } from "@/lib/api";
import { getContainerSelection, isSingleWordSelection, clearSelection } from "@/lib/selectionService";
import type { CourseChatState } from "@/lib/useCourseChat";
import type { CBTResult, Flashcard, TextAction, TextActionResult, TheoryQuestionResult, VisualizeResult } from "@/lib/types";

const AI_ACTIONS: { action: TextAction; label: string; icon: typeof Sparkles }[] = [
  { action: "explain", label: "Explain", icon: Sparkles },
  { action: "explain_simply", label: "Explain Simply", icon: Wand2 },
  { action: "example", label: "Example", icon: Lightbulb },
  { action: "analogy", label: "Analogy", icon: Repeat2 },
  { action: "summarize", label: "Summarize", icon: ScrollText },
  { action: "mnemonic", label: "Mnemonic", icon: ListChecks },
];

const QUIZ_ACTIONS: { action: TextAction; label: string; icon: typeof Sparkles }[] = [
  { action: "theory_question", label: "Theory Question", icon: ListTodo },
  { action: "cbt", label: "CBT Question", icon: ListChecks },
  { action: "visualize", label: "Visualize", icon: GitBranch },
];

const LANGUAGES = ["Yoruba", "Igbo", "Hausa", "Nigerian Pidgin", "French", "Spanish"];

const AI_LABEL: Record<TextAction, string> = {
  explain: "Explain",
  explain_simply: "Explain Simply",
  example: "Example",
  analogy: "Analogy",
  summarize: "Summarize",
  mnemonic: "Mnemonic",
  flashcards: "Flashcards",
  key_points: "Key Points",
  theory_question: "Theory Question",
  cbt: "CBT Question",
  visualize: "Visualize",
  translate: "Translate",
  define: "Define",
};

function formatCBT(r: CBTResult): string {
  const opts = r.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${i === r.correct_index ? " ✓" : ""}`);
  return `${r.question}\n\n${opts.join("\n")}\n\nWhy: ${r.explanation}`;
}

function formatTheoryQuestion(r: TheoryQuestionResult): string {
  return `${r.question}\n\nA strong answer would cover:\n${r.rubric_points.map((p) => `• ${p}`).join("\n")}`;
}

function formatResultForChat(
  action: TextAction,
  kind: "prose" | "list" | "object",
  result: TextActionResult["result"]
): { text: string; mermaid?: string } {
  if (kind === "prose") return { text: result as string };

  if (kind === "list") {
    if (action === "flashcards") {
      const text = (result as Flashcard[]).map((c, i) => `${i + 1}. ${c.front}\n   → ${c.back}`).join("\n\n");
      return { text };
    }
    const text = (result as string[]).map((point, i) => `${i + 1}. ${point}`).join("\n");
    return { text };
  }

  if (action === "theory_question") return { text: formatTheoryQuestion(result as TheoryQuestionResult) };
  if (action === "cbt") return { text: formatCBT(result as CBTResult) };
  if (action === "visualize") {
    const v = result as VisualizeResult;
    if (!v.applicable) return { text: v.reason || "This passage doesn't have a structure a diagram would clarify." };
    return { text: `Here's a ${v.diagram_type || "diagram"} of that:`, mermaid: v.mermaid };
  }
  return { text: JSON.stringify(result) };
}

export function HighlightToolbar({
  courseId,
  docId,
  containerRef,
  chat,
  onHighlightCreated,
}: {
  courseId: number;
  docId: string;
  containerRef: React.RefObject<HTMLElement>;
  chat: CourseChatState;
  onHighlightCreated: () => void;
}) {
  const [selection, setSelection] = useState<{ text: string; sectionIndex: number; x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"actions" | "bookmark-note" | "translate">("actions");
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState<TextAction | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  useEffect(() => {
    function onSelectionChange() {
      const found = getContainerSelection(containerRef.current);
      if (!found) return;
      // A single-word selection is what a double-click produces - that's
      // DefinitionPopover's territory, not this toolbar's (see
      // lib/selectionService.ts).
      if (isSingleWordSelection(found.text)) return;

      setSelection({
        text: found.text,
        sectionIndex: found.sectionIndex,
        x: found.rect.left + found.rect.width / 2,
        y: found.rect.top,
      });
      setMode("actions");
      setNote("");
    }

    function onMouseDown(e: MouseEvent) {
      // Dismiss when clicking outside the toolbar itself (not on every
      // mouseup, since that would close it before the click on an action
      // button inside the toolbar registers).
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) setSelection(null);
      }
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [containerRef]);

  if (!selection) return null;

  async function handleAIAction(action: TextAction) {
    if (!selection) return;
    setBusyAction(action);
    try {
      const res = await runTextAction(courseId, docId, action, selection.text);
      const { text, mermaid } = formatResultForChat(action, res.kind, res.result);
      chat.addAssistantMessage(
        `${AI_LABEL[action]}: "${selection.text.slice(0, 80)}${selection.text.length > 80 ? "…" : ""}"`,
        text,
        mermaid
      );
      clearSelection();
      setSelection(null);
    } catch (err) {
      push(err instanceof Error ? err.message : "That didn't work — try again", "error");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTranslate(language: string) {
    if (!selection) return;
    setBusyAction("translate");
    try {
      const res = await runTextAction(courseId, docId, "translate", selection.text, undefined, language);
      chat.addAssistantMessage(
        `Translate to ${language}: "${selection.text.slice(0, 80)}${selection.text.length > 80 ? "…" : ""}"`,
        res.result as string
      );
      clearSelection();
      setSelection(null);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't translate that — try again", "error");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopy() {
    if (!selection) return;
    await navigator.clipboard.writeText(selection.text);
    push("Copied");
    clearSelection();
    setSelection(null);
  }

  async function handleHighlight() {
    if (!selection) return;
    try {
      await createAnnotation(courseId, docId, "highlight", selection.sectionIndex, selection.text);
      onHighlightCreated();
      push("Highlighted");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save the highlight", "error");
    }
    clearSelection();
    setSelection(null);
  }

  async function handleSaveBookmark() {
    if (!selection) return;
    try {
      await createAnnotation(courseId, docId, "bookmark", selection.sectionIndex, selection.text, note.trim() || undefined);
      push("Bookmarked");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save the bookmark", "error");
    }
    clearSelection();
    setSelection(null);
  }

  return (
    <div
      ref={toolbarRef}
      className="fixed z-40 -translate-x-1/2 -translate-y-full rounded-xl border border-ink-border bg-ink-soft/95 p-1.5 shadow-2xl backdrop-blur-xl"
      style={{ left: selection.x, top: selection.y - 8 }}
    >
      {mode === "bookmark-note" ? (
        <div className="flex items-center gap-1.5 p-1">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveBookmark()}
            placeholder="Optional note…"
            className="w-40 rounded-lg border border-ink-border bg-ink px-2 py-1 text-xs text-paper placeholder:text-paper-faint focus-ring"
          />
          <button
            onClick={handleSaveBookmark}
            className="rounded-lg bg-ai-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-ai-accent-deep focus-ring"
          >
            Save
          </button>
        </div>
      ) : mode === "translate" ? (
        <div className="flex flex-wrap gap-1 p-1 max-w-[14rem]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => handleTranslate(lang)}
              disabled={busyAction !== null}
              className="rounded-lg px-2 py-1 text-xs text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-40"
            >
              {lang}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-0.5 max-w-xs">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.action}
              onClick={() => handleAIAction(a.action)}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-40"
            >
              <a.icon size={12} className={busyAction === a.action ? "animate-pulse text-ai-accent" : ""} />
              {a.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-ink-border" />
          {QUIZ_ACTIONS.map((a) => (
            <button
              key={a.action}
              onClick={() => handleAIAction(a.action)}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-40"
            >
              <a.icon size={12} className={busyAction === a.action ? "animate-pulse text-ai-accent" : ""} />
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setMode("translate")}
            disabled={busyAction !== null}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-40"
          >
            <Languages size={12} />
            Translate
          </button>
          <span className="mx-1 h-4 w-px bg-ink-border" />
          <button
            onClick={handleCopy}
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            aria-label="Copy"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={handleHighlight}
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            aria-label="Highlight"
          >
            <Highlighter size={13} />
          </button>
          <button
            onClick={() => setMode("bookmark-note")}
            className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            aria-label="Bookmark"
          >
            <BookMarked size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
