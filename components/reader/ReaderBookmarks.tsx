"use client";

import { AnnotationList } from "@/components/reader/AnnotationList";
import type { Annotation } from "@/lib/types";

export function ReaderBookmarks({
  courseId,
  docId,
  bookmarks,
  onJump,
  onChanged,
}: {
  courseId: number;
  docId: string;
  bookmarks: Annotation[];
  onJump: (sectionIndex: number) => void;
  onChanged: () => void;
}) {
  return (
    <AnnotationList
      courseId={courseId}
      docId={docId}
      items={bookmarks}
      emptyLabel="No bookmarks yet — select text and use the Bookmark action."
      accentClass="bg-achievement"
      onJump={onJump}
      onChanged={onChanged}
    />
  );
}
