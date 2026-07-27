"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { GLOBAL_NAV } from "@/lib/nav";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-border bg-ink/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-stretch justify-around">
        {GLOBAL_NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors focus-ring",
                active ? "text-navy" : "text-paper-faint"
              )}
            >
              <item.icon size={19} strokeWidth={active ? 2.4 : 2} />
              {item.label === "Smart Library" ? "Library" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
