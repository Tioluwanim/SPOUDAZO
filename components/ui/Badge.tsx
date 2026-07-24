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
    amber: "bg-ai-accent/15 text-ai-accent",
    teal: "bg-success/15 text-success",
    clay: "bg-danger/15 text-danger",
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