"use client";

import { AnnotationList } from "@/components/reader/AnnotationList";
import type { Annotation } from "@/lib/types";

export function ReaderHighlights({
  courseId,
  docId,
  highlights,
  onJump,
  onChanged,
}: {
  courseId: number;
  docId: string;
  highlights: Annotation[];
  onJump: (sectionIndex: number) => void;
  onChanged: () => void;
}) {
  return (
    <AnnotationList
      courseId={courseId}
      docId={docId}
      items={highlights}
      emptyLabel="No highlights yet — select text and use the Highlight action."
      accentClass="bg-ai-accent"
      onJump={onJump}
      onChanged={onChanged}
    />
  );
}
