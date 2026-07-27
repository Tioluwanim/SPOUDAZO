/**
 * lib/taskTiming.ts - Remembers how long each AI task actually took on this
 * device, so progress estimates get more accurate the more the student uses
 * the app instead of always showing the same generic guess.
 *
 * Deliberately just a rolling average in localStorage, not a backend
 * telemetry endpoint - the estimate only needs to be "close enough to stop
 * the spinner feeling infinite," and per-device historical timing is both
 * simpler and sufficient for that.
 */

const STORAGE_KEY = "spoudazo:task-timings";
const MAX_SAMPLES_PER_TASK = 5;

type TimingStore = Record<string, number[]>;

function readStore(): TimingStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TimingStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: TimingStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable - the estimate just won't persist this time.
  }
}

/** Average observed duration (seconds) for a task, or null if we have no history yet. */
export function getHistoricalEstimate(taskKey: string): number | null {
  const samples = readStore()[taskKey];
  if (!samples || samples.length === 0) return null;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

/** Records how long a completed task actually took, keeping only the most recent samples. */
export function recordTaskDuration(taskKey: string, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const store = readStore();
  const samples = [...(store[taskKey] || []), seconds].slice(-MAX_SAMPLES_PER_TASK);
  store[taskKey] = samples;
  writeStore(store);
}
