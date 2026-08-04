import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-ink-border bg-ink-surface/70 shadow-sm backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
