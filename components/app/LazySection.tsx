"use client";

import { useEffect, useRef, useState } from "react";

/**
 * components/app/LazySection.tsx - Section 14's "virtual rendering" /
 * "incremental loading", scoped honestly: this is NOT a windowing
 * library like react-window (which unmounts content as it scrolls past,
 * for lists of hundreds/thousands of items). A lecture document here is
 * realistically tens of sections, not thousands - full windowing would
 * add real complexity (measuring variable heights, keeping scroll
 * position stable) for a scale where it doesn't pay for itself.
 *
 * What this DOES do: defer rendering a section's actual content (and
 * everything nested in it - highlights, sticky notes) until it's within
 * `rootMargin` of the viewport, so opening a long document doesn't pay
 * the render cost for every section immediately. Once rendered, content
 * stays mounted (refs for scroll-to-section and the selection/highlight
 * logic depend on the DOM node persisting), so this is "lazy mount",
 * not "virtualize" in the strict sense.
 */
export function LazySection({
  placeholderHeight = 120,
  children,
}: {
  placeholderHeight?: number;
  children: React.ReactNode;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldRender || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" } // start rendering well before it's actually on screen, so scrolling never outruns it
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shouldRender]);

  if (!shouldRender) {
    return <div ref={ref} style={{ minHeight: placeholderHeight }} className="animate-pulse rounded-xl bg-ink-surface/40" />;
  }

  return <>{children}</>;
}
