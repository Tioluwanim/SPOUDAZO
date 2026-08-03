"use client";

import { Search } from "lucide-react";

export function DocumentSearch({
  mode,
  query,
  onChange,
  matchCount,
}: {
  mode: "ai" | "pdf";
  query: string;
  onChange: (value: string) => void;
  matchCount: number;
}) {
  if (mode === "pdf") {
    return (
      <div
        className="relative"
        title="Search inside the original PDF isn't available yet — switch to AI Reading to search this document's text"
      >
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-paper-faint" />
        <input
          disabled
          placeholder="Search (switch to AI Reading)"
          className="w-44 cursor-not-allowed rounded-lg border border-ink-border bg-ink-surface py-1.5 pl-7 pr-2 text-xs text-paper-faint placeholder:text-paper-faint focus-ring"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-paper-faint" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search in document"
          aria-label="Search in document"
          className="w-44 rounded-lg border border-ink-border bg-ink-surface py-1.5 pl-7 pr-2 text-xs text-paper placeholder:text-paper-faint focus-ring"
        />
      </div>
      {query && (
        <span className="text-xs text-paper-faint" aria-live="polite">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      )}
    </div>
  );
}
