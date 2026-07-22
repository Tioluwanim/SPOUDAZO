import clsx from "clsx";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "teal" | "clay";
}) {
  const tones = {
    neutral: "bg-ink-border/60 text-paper-dim",
    amber: "bg-amber-glow/15 text-amber-glow",
    teal: "bg-teal-mastery/15 text-teal-mastery",
    clay: "bg-clay-alert/15 text-clay-alert",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
