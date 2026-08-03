"use client";

import { FileText } from "lucide-react";
import type { DocumentSection } from "@/lib/types";

export function TableOfContents({
  sections,
  activeIndex,
  onSelect,
}: {
  sections: DocumentSection[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (sections.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-paper-faint">No sections in this document yet.</p>;
  }

  return (
    <ul className="space-y-0.5 px-2" role="navigation" aria-label="Table of contents">
      {sections.map((section, i) => (
        <li key={i}>
          <button
            onClick={() => onSelect(i)}
            aria-current={i === activeIndex ? "true" : undefined}
            className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-ring ${
              i === activeIndex
                ? "bg-ai-accent/15 text-ai-accent"
                : "text-paper-dim hover:bg-ink-border hover:text-paper"
            }`}
          >
            <FileText size={12} className="shrink-0" />
            <span className="truncate">{section.title}</span>
            {section.page_start > 0 && (
              <span className="ml-auto shrink-0 font-mono text-[10px] text-paper-faint">
                p.{section.page_start}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
