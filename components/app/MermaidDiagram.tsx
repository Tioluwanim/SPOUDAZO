"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

/** Renders a Mermaid diagram string to inline SVG. Dynamically imported so
 * the ~500KB mermaid bundle only loads for students who actually use
 * Visualize, not on every page that mounts the chat panel. */
export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
          mermaidInitialized = true;
        }
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setError("Couldn't render this diagram");
      }
    }
    render();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return <p className="text-xs text-danger">{error}</p>;
  }

  return <div ref={containerRef} className="overflow-x-auto rounded-lg bg-ink p-3" />;
}
