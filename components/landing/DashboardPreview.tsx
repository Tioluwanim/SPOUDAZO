"use client";

import { motion } from "framer-motion";
import { Flame, Target, CalendarDays, Sparkles, ArrowUpRight, Plus } from "lucide-react";
import { FrequencyPulse } from "./FrequencyPulse";

export function DashboardPreview() {
  return (
    <section id="dashboard-preview" className="relative border-t border-ink-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-14 max-w-xl text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-gold-deep">
            Every day you open it
          </span>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            One screen, everything that matters.
          </h2>
          <p className="mt-4 text-paper-dim">
            Your streak, your weak topics, and what to study next — in that
            order of priority, not buried under a syllabus.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="rounded-[28px] border border-gold/20 bg-ink-surface/60 p-3 shadow-gold-lg sm:p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:grid-rows-2">
            {/* Streak */}
            <Widget className="sm:col-span-2">
              <WidgetLabel icon={Flame} label="Study streak" />
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl text-paper">12</span>
                <span className="text-sm text-paper-dim">days running</span>
              </div>
              <div className="mt-4 flex gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < 6 ? "bg-gold" : "bg-ink-border"}`}
                  />
                ))}
              </div>
            </Widget>

            {/* Today's goal */}
            <Widget className="sm:col-span-2">
              <WidgetLabel icon={Target} label="Today's goal" />
              <p className="mt-3 text-sm leading-relaxed text-paper">
                Clear <span className="text-gold-deep">2 CBT sets</span> on Neural
                Network Training before 8pm.
              </p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
                <div className="h-full w-2/3 rounded-full bg-gold" />
              </div>
            </Widget>

            {/* Weekly progress */}
            <Widget className="sm:col-span-2 sm:row-span-2">
              <WidgetLabel icon={ArrowUpRight} label="Weekly progress" />
              <div className="mt-4 flex h-24 items-end gap-2">
                {[40, 55, 35, 70, 60, 90, 75].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-gold/20">
                    <div
                      className="w-full rounded-t-md bg-gold"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-paper-faint">
                Mon–Sun · questions attempted
              </p>
              <div className="mt-5 border-t border-ink-border pt-4">
                <WidgetLabel icon={CalendarDays} label="Upcoming" />
                <p className="mt-2 text-sm text-paper">CPE 316 — 9 days away</p>
              </div>
            </Widget>

            {/* Weak topics */}
            <Widget className="sm:col-span-2">
              <WidgetLabel icon={Sparkles} label="Weak topics" />
              <div className="mt-3 space-y-2">
                <TopicRow label="Perceptron convergence" pct={34} />
                <TopicRow label="Àdáṣẹ / autonomous agents" pct={58} />
              </div>
            </Widget>

            {/* Recommended session */}
            <Widget className="sm:col-span-2">
              <WidgetLabel icon={Plus} label="Recommended session" />
              <p className="mt-3 text-sm leading-relaxed text-paper-dim">
                15 min · Perceptron convergence drill, grounded in your CPE
                316 slides.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold-deep">
                Start now
              </span>
            </Widget>
          </div>

          <div className="mt-3 rounded-2xl border border-ink-border bg-ink-soft/60 p-4">
            <FrequencyPulse className="h-10 opacity-80" />
          </div>
        </motion.div>

        <p className="mt-4 text-center font-mono text-[11px] text-paper-faint">
          Illustrative preview — your real dashboard fills in with your own courses.
        </p>
      </div>
    </section>
  );
}

function Widget({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-ink-border bg-ink-soft/70 p-5 transition-colors hover:border-gold/30 ${className}`}
    >
      {children}
    </div>
  );
}

function WidgetLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-paper-faint">
      <Icon size={12} className="text-gold-deep" />
      {label}
    </div>
  );
}

function TopicRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-paper-dim">{label}</span>
        <span className="font-mono text-paper-faint">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-danger/70 to-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
