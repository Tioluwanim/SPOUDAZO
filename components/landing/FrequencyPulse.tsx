"use client";

// The signature visual: a row of bars representing how often a topic
// recurred across past exam papers. Heights are seeded once (not random
// per render) so server/client output matches, then animate with a
// staggered pulse to feel alive without implying randomness — the point
// is that this data is counted, not guessed.
const HEIGHTS = [22, 38, 64, 30, 88, 46, 96, 58, 34, 72, 26, 82, 40, 60, 20];

export function FrequencyPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-end gap-[3px] ${className}`}
      aria-hidden="true"
    >
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className="w-2 origin-bottom rounded-full bg-gradient-to-t from-gold-deep to-gold animate-pulseBar"
          style={{
            height: `${h}px`,
            animationDelay: `${(i % 7) * 0.15}s`,
            animationDuration: `${2.2 + (i % 5) * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
