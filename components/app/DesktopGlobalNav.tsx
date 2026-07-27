"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { GLOBAL_NAV } from "@/lib/nav";

export function DesktopGlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {GLOBAL_NAV.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tourId}
            className={clsx(
              "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-ring",
              active ? "text-paper" : "text-paper-faint hover:text-paper-dim"
            )}
          >
            <item.icon size={14} />
            {item.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-[17px] h-0.5 rounded-full bg-navy" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
