"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle size={26} />
        </div>
        <h1 className="mb-2 font-display text-xl text-paper">Something went wrong</h1>
        <p className="mb-6 text-sm text-paper-dim">
          That's on us, not you. Try again, or head back to your dashboard.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}