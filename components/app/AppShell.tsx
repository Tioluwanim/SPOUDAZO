"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { DesktopGlobalNav } from "@/components/app/DesktopGlobalNav";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";
import { FeedbackButton } from "@/components/app/FeedbackButton";

export function AppShell({
  crumbs,
  sidebar,
  children,
}: {
  crumbs?: { label: string; href?: string }[];
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink-border bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/dashboard" className="shrink-0 font-display italic text-lg text-paper">
              Spoudazõ
            </Link>
            <DesktopGlobalNav />
          </div>
          <div className="shrink-0">
            <ProfileMenu />
          </div>
        </div>

        {crumbs && crumbs.length > 0 && (
          <div className="border-t border-ink-border/60 px-4 py-2 sm:px-6">
            <nav className="mx-auto flex max-w-6xl min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-paper-faint [scrollbar-width:none]">
              {crumbs.map((c, i) => (
                <span key={i} className="flex shrink-0 items-center gap-2">
                  {c.href ? (
                    <Link href={c.href} className="max-w-[9rem] truncate transition-colors hover:text-paper sm:max-w-none">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="max-w-[9rem] truncate text-paper-dim sm:max-w-none">{c.label}</span>
                  )}
                  {i < crumbs.length - 1 && <span className="shrink-0">/</span>}
                </span>
              ))}
            </nav>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {sidebar ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
            {sidebar}
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          children
        )}
      </div>

      <MobileBottomNav />
      <FeedbackButton />
    </div>
  );
}
