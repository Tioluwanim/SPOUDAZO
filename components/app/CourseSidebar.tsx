"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, CalendarDays, ChevronDown, Layers, type LucideIcon } from "lucide-react";
import type { Course, Topic } from "@/lib/types";

/**
 * CourseSidebar - shown on every page inside a course (overview, topic
 * practice, weak areas, planner).
 *
 * Two genuinely different layouts, not one layout squeezed to fit both:
 * on mobile, a vertical sidebar taking full width above the content
 * would push everything else down a whole screen before a student sees
 * any actual content, so mobile gets a horizontal pill nav + a
 * collapsed-by-default topic list instead. Desktop keeps the original
 * always-visible vertical sidebar with frequency bars. Rendered as two
 * separate blocks switched by breakpoint rather than one dynamically
 * reflowing layout - simpler to get right than JS-driven show/hide state.
 */
export function CourseSidebar({
  course,
  courseId,
  topics,
  activeTopicId,
}: {
  course: Course;
  courseId: number;
  topics: Topic[];
  activeTopicId?: number;
}) {
  const pathname = usePathname();
  const isOverview = pathname === `/courses/${courseId}`;
  const isWeakAreas = pathname === `/courses/${courseId}/weak-areas`;
  const isPlanner = pathname === `/courses/${courseId}/planner`;

  const sorted = topics.slice().sort((a, b) => b.frequency_score - a.frequency_score);
  const maxFrequency = sorted.reduce((max, t) => Math.max(max, t.frequency_score), 0);

  const navLinks = [
    { href: `/courses/${courseId}`, active: isOverview, icon: Layers, label: "Overview" },
    ...(topics.length > 0
      ? [
          {
            href: `/courses/${courseId}/planner`,
            active: isPlanner,
            icon: CalendarDays,
            label: "Study planner",
          },
          {
            href: `/courses/${courseId}/weak-areas`,
            active: isWeakAreas,
            icon: BarChart3,
            label: "Weak areas",
          },
        ]
      : []),
  ];

  return (
    <>
      {/* ── Mobile / tablet: horizontal pill nav + collapsible topic list ── */}
      <div className="lg:hidden">
        <div className="mb-3">
          <span className="font-mono text-xs uppercase tracking-widest text-amber-glow">
            {course.code}
          </span>
          <h2 className="truncate font-display text-lg text-paper">{course.name}</h2>
        </div>

        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-ring",
                link.active
                  ? "border-amber-glow/50 bg-amber-glow/10 text-paper"
                  : "border-ink-border text-paper-dim"
              )}
            >
              <link.icon size={14} />
              {link.label}
            </Link>
          ))}
        </div>

        {sorted.length > 0 && (
          <details className="group mb-6 rounded-xl border border-ink-border bg-ink-surface/60">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-paper-dim focus-ring">
              <span>Topics ({sorted.length})</span>
              <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-0.5 border-t border-ink-border p-2">
              {sorted.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  courseId={courseId}
                  active={topic.id === activeTopicId}
                  maxFrequency={maxFrequency}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Desktop: always-visible vertical sidebar ── */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="mb-6">
          <span className="font-mono text-xs uppercase tracking-widest text-amber-glow">
            {course.code}
          </span>
          <h2 className="mt-1 truncate font-display text-lg text-paper">{course.name}</h2>
        </div>

        <nav className="mb-6 flex flex-col gap-1">
          {navLinks.map((link) => (
            <SidebarLink key={link.href} href={link.href} active={link.active} icon={link.icon}>
              {link.label}
            </SidebarLink>
          ))}
        </nav>

        {sorted.length > 0 && (
          <div>
            <p className="mb-2 px-2 font-mono text-[11px] uppercase tracking-widest text-paper-faint">
              Topics
            </p>
            <div className="flex flex-col gap-0.5">
              {sorted.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  courseId={courseId}
                  active={topic.id === activeTopicId}
                  maxFrequency={maxFrequency}
                />
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function TopicRow({
  topic,
  courseId,
  active,
  maxFrequency,
}: {
  topic: Topic;
  courseId: number;
  active: boolean;
  maxFrequency: number;
}) {
  const pct = maxFrequency > 0 ? Math.max(8, (topic.frequency_score / maxFrequency) * 100) : 8;
  const isHot = maxFrequency > 0 && topic.frequency_score / maxFrequency >= 0.6;

  return (
    <Link
      href={`/courses/${courseId}/topics/${topic.id}`}
      className={clsx(
        "group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-ring",
        active ? "bg-ink-border/60 text-paper" : "text-paper-dim hover:bg-ink-border/30 hover:text-paper"
      )}
    >
      <span className="flex h-8 w-1.5 shrink-0 items-end overflow-hidden rounded-full bg-ink-border/60">
        <span
          className={clsx("w-full rounded-full transition-all", isHot ? "bg-amber-glow" : "bg-paper-faint/60")}
          style={{ height: `${pct}%` }}
        />
      </span>
      <span className="truncate">{topic.name}</span>
    </Link>
  );
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-ring",
        active ? "bg-ink-border/60 text-paper" : "text-paper-dim hover:bg-ink-border/30 hover:text-paper"
      )}
    >
      <Icon size={15} />
      {children}
    </Link>
  );
}
