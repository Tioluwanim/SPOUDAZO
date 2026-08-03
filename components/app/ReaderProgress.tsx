"use client";

const WORDS_PER_MINUTE = 200;

export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

export function ReaderProgress({ percent }: { percent: number }) {
  return (
    <div
      className="h-0.5 w-full bg-ink-border/40"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="h-full bg-ai-accent transition-[width] duration-150"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
