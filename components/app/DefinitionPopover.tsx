"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X as XIcon } from "lucide-react";
import { runTextAction } from "@/lib/api";
import { getContainerSelection, isSingleWordSelection } from "@/lib/selectionService";
import type { DefineResult } from "@/lib/types";

const DIFFICULTY_COLOR: Record<DefineResult["difficulty_level"], string> = {
  easy: "text-success",
  medium: "text-achievement",
  hard: "text-danger",
};

/**
 * Double-click a word to define it. This is a deliberate adaptation of
 * "hover to define" from the original spec: this reader renders section
 * text as plain paragraphs, and true per-word hover would mean wrapping
 * every single word in its own <span> - hundreds of extra DOM nodes per
 * section, and it would fragment the text nodes the highlight-to-ask
 * selection logic depends on. Double-click already selects exactly one
 * word natively in every browser, so it reuses that instead of adding a
 * span-per-word markup layer just to detect hover.
 */
export function DefinitionPopover({
  courseId,
  docId,
  containerRef,
}: {
  courseId: number;
  docId: string;
  containerRef: React.RefObject<HTMLElement>;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading"; x: number; y: number }
    | { status: "loaded"; x: number; y: number; data: DefineResult }
    | { status: "error"; x: number; y: number }
  >({ status: "idle" });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function onDblClick(e: MouseEvent) {
      const found = getContainerSelection(containerRef.current);
      if (!found || !isSingleWordSelection(found.text) || found.text.length < 2) return;

      setState({ status: "loading", x: e.clientX, y: e.clientY });
      try {
        const res = await runTextAction(courseId, docId, "define", found.text);
        setState({ status: "loaded", x: e.clientX, y: e.clientY, data: res.result as DefineResult });
      } catch {
        setState({ status: "error", x: e.clientX, y: e.clientY });
      }
    }

    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setState({ status: "idle" });
      }
    }

    document.addEventListener("dblclick", onDblClick);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("dblclick", onDblClick);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [containerRef, courseId, docId]);

  if (state.status === "idle") return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-40 w-72 -translate-x-1/2 rounded-xl border border-ink-border bg-ink-soft/95 p-3.5 shadow-2xl backdrop-blur-xl"
      style={{ left: state.x, top: state.y + 16 }}
    >
      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-paper-faint">
          <Loader2 size={13} className="animate-spin" /> Looking that up…
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs text-danger">Couldn&apos;t look that up — try again.</p>
      )}

      {state.status === "loaded" && (
        <>
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm text-paper">{state.data.term}</p>
              {state.data.pronunciation && (
                <p className="font-mono text-[11px] text-paper-faint">/{state.data.pronunciation}/</p>
              )}
            </div>
            <button
              onClick={() => setState({ status: "idle" })}
              className="text-paper-faint hover:text-paper focus-ring"
              aria-label="Close"
            >
              <XIcon size={13} />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-paper-dim">{state.data.definition}</p>
          <p className="mt-2 text-xs leading-relaxed text-paper-faint">{state.data.simple_explanation}</p>
          {state.data.related_concepts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {state.data.related_concepts.map((c) => (
                <span key={c} className="rounded-full bg-ink-border/60 px-2 py-0.5 text-[10px] text-paper-dim">
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-paper-faint">
            <span className={DIFFICULTY_COLOR[state.data.difficulty_level]}>{state.data.difficulty_level}</span>
            <span>·</span>
            <span>~{state.data.estimated_learning_time_minutes} min to learn</span>
          </div>
        </>
      )}
    </div>
  );
}
