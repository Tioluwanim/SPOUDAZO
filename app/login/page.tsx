"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth, friendlyAuthError } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block font-display italic text-2xl text-paper">
          Spoudazõ
        </Link>
        <h1 className="mb-1 font-display text-2xl text-paper">Welcome back</h1>
        <p className="mb-8 text-sm text-paper-dim">Sign in to keep studying where you left off.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Email</label>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-ink-border bg-ink-surface px-4 py-2.5 text-paper placeholder:text-paper-faint focus-ring"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-ink-border bg-ink-surface px-4 py-2.5 text-paper placeholder:text-paper-faint focus-ring"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-clay-alert">{error}</p>}
          <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-paper-dim">
          New here?{" "}
          <Link href="/signup" className="text-amber-glow hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
