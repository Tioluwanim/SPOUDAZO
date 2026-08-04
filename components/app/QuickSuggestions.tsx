"use client";

export function QuickSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-full border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs text-paper-dim transition-colors hover:border-gold hover:text-paper focus-ring"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
