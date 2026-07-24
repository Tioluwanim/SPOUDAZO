import Link from "next/link";
import { BookOpen, Sparkles, BarChart3 } from "lucide-react";
import { FrequencyPulse } from "@/components/landing/FrequencyPulse";

const VALUE_PROPS = [
  {
    icon: BookOpen,
    title: "Grounded in your own notes",
    body: "Every question and answer traces back to the material you actually uploaded — not a generic syllabus summary.",
  },
  {
    icon: Sparkles,
    title: "Finds what repeats",
    body: "Past questions get scanned for the topics your lecturers keep coming back to.",
  },
  {
    icon: BarChart3,
    title: "Tracks your weak spots",
    body: "Every practice attempt updates your mastery per topic, so you always know where to focus next.",
  },
];

/**
 * AuthLayout - two columns on desktop (brand panel + form), single
 * column on mobile (brand panel collapses to a small header so the form
 * stays the focus on small screens where space is tight).
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel - desktop only */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 grain-overlay opacity-10" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-ai-accent/10 blur-[140px]" />

        <Link href="/" className="relative font-display italic text-2xl">
          Spoudazõ
        </Link>

        <div className="relative">
          <h2 className="text-balance font-display text-3xl leading-tight">
            Study what actually shows up <span className="italic text-achievement">on the exam.</span>
          </h2>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <FrequencyPulse className="h-16" />
          </div>

          <div className="mt-10 space-y-6">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai-accent/15 text-ai-accent">
                  <v.icon size={15} />
                </span>
                <div>
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-xs text-white/40">Built at Obafemi Awolowo University</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-ink px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block font-display italic text-2xl text-paper lg:hidden">
            Spoudazõ
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}