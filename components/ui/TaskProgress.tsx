"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import type { TaskStatus } from "@/lib/useTaskProgress";

export function TaskProgress({
  status,
  step,
  progressPercent,
  etaLabel,
  errorMessage,
  onRetry,
  compact = false,
}: {
  status: TaskStatus;
  /** Current step label, e.g. "Generating embeddings…" */
  step: string;
  progressPercent: number;
  /** e.g. "~12s remaining" - omitted once there's nothing meaningful left to estimate. */
  etaLabel?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /** Tighter padding for inline use (e.g. next to a button) instead of a standalone card. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "rounded-xl border border-ink-border bg-ink-surface/50 px-4 py-3"}>
      <div className="flex items-center gap-2.5">
        <AnimatePresence mode="wait" initial={false}>
          {status === "running" && (
            <motion.span key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 size={16} className="animate-spin text-ai-accent" />
            </motion.span>
          )}
          {status === "success" && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckCircle2 size={16} className="text-success" />
            </motion.span>
          )}
          {status === "error" && (
            <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <XCircle size={16} className="text-danger" />
            </motion.span>
          )}
        </AnimatePresence>

        <span className="flex-1 text-sm text-paper-dim">
          {status === "error" ? errorMessage || "Something went wrong" : step}
        </span>

        {status === "running" && etaLabel && (
          <span className="text-xs text-paper-faint">{etaLabel}</span>
        )}

        {status === "error" && onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw size={13} /> Retry
          </Button>
        )}
      </div>

      {status === "running" && (
        <div className="mt-2.5">
          <ProgressBar value={progressPercent} />
        </div>
      )}
    </div>
  );
}
