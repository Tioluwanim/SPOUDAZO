"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getIdToken } from "@/lib/firebase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Page thumbnails are served from an auth-protected endpoint (student
 * material, not public) - a plain <img src="..."> can't attach the
 * Authorization header FastAPI requires, so this fetches the bytes
 * itself and hands the browser an object URL instead.
 */
export function AuthedThumbnail({
  courseId,
  docId,
  page,
  className,
}: {
  courseId: number;
  docId: string;
  page: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("signed out");
        const res = await fetch(
          `${BASE_URL}/courses/${courseId}/materials/${docId}/thumbnails/${page}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("thumbnail unavailable");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, docId, page]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-ink-surface text-paper-faint ${className || ""}`}>
        <FileText size={16} />
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse bg-ink-surface ${className || ""}`} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Page ${page}`} className={className} />;
}
