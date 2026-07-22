import { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-border px-8 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink-surface text-paper-faint">
        <Icon size={20} />
      </div>
      <h3 className="font-display text-lg text-paper">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-paper-dim">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
