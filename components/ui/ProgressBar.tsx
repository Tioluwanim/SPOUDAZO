import clsx from "clsx";

export function ProgressBar({
  value,
  max = 100,
  tone = "amber",
}: {
  value: number;
  max?: number;
  tone?: "amber" | "teal" | "clay";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tones = {
    amber: "bg-gold",
    teal: "bg-teal-mastery",
    clay: "bg-clay-alert",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-border/60">
      <div
        className={clsx("h-full rounded-full transition-all duration-700 ease-out", tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
