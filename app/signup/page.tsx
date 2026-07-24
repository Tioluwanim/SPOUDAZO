"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthLayout } from "@/components/app/AuthLayout";
import { useAuth, friendlyAuthError } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading, signUp } = useAuth();
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
      await signUp(email, password);
      router.push("/onboarding");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="mb-1 font-display text-2xl text-paper">Create your account</h1>
      <p className="mb-8 text-sm text-paper-dim">
        Free to start - upload your first course right after.
      </p>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-ink-border bg-ink-surface px-4 py-2.5 text-paper placeholder:text-paper-faint focus-ring"
            placeholder="At least 6 characters"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-paper-dim">
        Already have an account?{" "}
        <Link href="/login" className="text-ai-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}