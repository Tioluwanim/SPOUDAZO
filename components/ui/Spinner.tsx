export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-paper-dim">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ai-accent border-t-transparent" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}