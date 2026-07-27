"use client";

import { useCallback, useRef, useState } from "react";
import { getHistoricalEstimate, recordTaskDuration } from "@/lib/taskTiming";

export type TaskStatus = "idle" | "running" | "success" | "error";

const TICK_MS = 200;
// Progress creeps toward this ceiling as the estimate elapses, then holds -
// it only ever reaches 100% when the task actually finishes, so a slower-
// than-usual run never looks like it hung at 100% while still working.
const RUNNING_CEILING = 92;

/**
 * Drives a fake-but-honest progress bar for a single blocking API call
 * (question generation, study plan creation, AI marking, topic extraction -
 * anything that's one request/response with no server-side step reporting).
 *
 * "Honest" because the percentage is derived from how long this *type* of
 * task has actually taken on this device before (see lib/taskTiming), not a
 * made-up animation - a task the student has run before shows an estimate
 * that reflects that, and every completed run refines the next one's guess.
 */
export function useTaskProgress(taskKey: string, defaultEstimateSeconds: number, label: string) {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunRef = useRef<(() => Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      const estimate = getHistoricalEstimate(taskKey) ?? defaultEstimateSeconds;
      const startedAt = Date.now();

      setStatus("running");
      setErrorMessage(undefined);
      setProgressPercent(0);
      setEtaSeconds(Math.round(estimate));
      lastRunRef.current = () => run(fn).then(() => undefined);

      clearTimer();
      intervalRef.current = setInterval(() => {
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const pct = Math.min(RUNNING_CEILING, (elapsedSeconds / estimate) * 100);
        setProgressPercent(pct);
        setEtaSeconds(Math.max(0, Math.round(estimate - elapsedSeconds)));
      }, TICK_MS);

      try {
        const result = await fn();
        clearTimer();
        recordTaskDuration(taskKey, (Date.now() - startedAt) / 1000);
        setProgressPercent(100);
        setStatus("success");
        return result;
      } catch (err) {
        clearTimer();
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
        return undefined;
      }
    },
    [taskKey, defaultEstimateSeconds, clearTimer]
  );

  const retry = useCallback(() => {
    lastRunRef.current?.();
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setStatus("idle");
    setProgressPercent(0);
    setEtaSeconds(null);
    setErrorMessage(undefined);
  }, [clearTimer]);

  const etaLabel =
    status === "running" && etaSeconds !== null
      ? etaSeconds > 0
        ? `~${etaSeconds}s remaining`
        : "almost there…"
      : undefined;

  return {
    status,
    progressPercent,
    etaLabel,
    errorMessage,
    step: label,
    run,
    retry,
    reset,
  };
}
