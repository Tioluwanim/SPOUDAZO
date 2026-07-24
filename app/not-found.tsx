import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ai-accent/10 text-ai-accent">
          <Compass size={26} />
        </div>
        <h1 className="mb-2 font-display text-xl text-paper">Page not found</h1>
        <p className="mb-6 text-sm text-paper-dim">
          This page doesn't exist, or you don't have access to it.
        </p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}