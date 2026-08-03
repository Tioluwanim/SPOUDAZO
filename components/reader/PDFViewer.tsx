"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { getIdToken } from "@/lib/firebase";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Original PDF mode. Uses react-pdf (pdf.js) against the range-request-
 * capable /file streaming endpoint (see app/api/materials.py) - pdf.js
 * issues Range requests itself for page-by-page lazy loading, so this
 * never downloads the whole PDF up front even for a large file.
 *
 * The endpoint requires auth, which react-pdf's `file` prop supports
 * directly via `httpHeaders` (no need for the AuthedThumbnail-style
 * blob-URL workaround used elsewhere in the reader).
 */
export function PDFViewer({
  courseId,
  docId,
  initialPage = 1,
  onPageChange,
  currentPageRef,
}: {
  courseId: number;
  docId: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  currentPageRef?: React.MutableRefObject<((page: number) => void) | null>;
}) {
  const [authHeader, setAuthHeader] = useState<Record<string, string> | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.1);
  const [fitMode, setFitMode] = useState<"width" | "page">("width");
  const [containerWidth, setContainerWidth] = useState(600);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    getIdToken().then((token) => {
      if (token) setAuthHeader({ Authorization: `Bearer ${token}` });
    });
  }, []);

  useEffect(() => {
    function measure() {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth - 48);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (currentPageRef) {
      currentPageRef.current = (page: number) => {
        pageRefs.current[page]?.scrollIntoView({ behavior: "smooth", block: "start" });
        setPageNumber(page);
      };
    }
  }, [currentPageRef]);

  const fileSource = useMemo(
    () => (authHeader ? { url: `${BASE_URL}/courses/${courseId}/materials/${docId}/file`, httpHeaders: authHeader } : null),
    [authHeader, courseId, docId]
  );

  function jump(delta: number) {
    const next = Math.min(Math.max(1, pageNumber + delta), numPages || 1);
    pageRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPageNumber(next);
    onPageChange?.(next);
  }

  const pageWidth = fitMode === "width" ? containerWidth : undefined;
  const effectiveScale = fitMode === "page" ? scale : undefined;

  if (!fileSource) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Preparing PDF…" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-2 border-b border-ink-border px-4 py-2">
        <button
          onClick={() => jump(-1)}
          disabled={pageNumber <= 1}
          aria-label="Previous page"
          className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="w-20 text-center font-mono text-xs text-paper-faint">
          {pageNumber} / {numPages || "…"}
        </span>
        <button
          onClick={() => jump(1)}
          disabled={pageNumber >= numPages}
          aria-label="Next page"
          className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>

        <span className="mx-2 h-4 w-px bg-ink-border" />

        <button
          onClick={() => setFitMode("width")}
          aria-label="Fit width"
          className={`rounded-lg p-1.5 hover:bg-ink-border focus-ring ${fitMode === "width" ? "text-ai-accent" : "text-paper-dim hover:text-paper"}`}
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={() => setFitMode("page")}
          aria-label="Zoom mode"
          className={`rounded-lg p-1.5 hover:bg-ink-border focus-ring ${fitMode === "page" ? "text-ai-accent" : "text-paper-dim hover:text-paper"}`}
        >
          <Minimize2 size={14} />
        </button>
        {fitMode === "page" && (
          <>
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              aria-label="Zoom out"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-10 text-center text-xs text-paper-faint">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
              aria-label="Zoom in"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <ZoomIn size={14} />
            </button>
          </>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto bg-ink-surface/20 py-6">
        {loadError ? (
          <p className="px-6 text-center text-sm text-danger">{loadError}</p>
        ) : (
          <Document
            file={fileSource}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError("Couldn't load the original PDF. Try Original PDF mode again in a moment.")}
            loading={
              <div className="flex justify-center py-16">
                <Spinner label="Loading PDF…" />
              </div>
            }
            className="flex flex-col items-center gap-6"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
              <div key={page} ref={(el) => { pageRefs.current[page] = el; }} className="shadow-xl">
                <Page
                  pageNumber={page}
                  width={pageWidth}
                  scale={effectiveScale}
                  loading={<div className="flex h-[600px] w-full animate-pulse items-center justify-center bg-ink-surface/40 text-xs text-paper-faint">Page {page}</div>}
                  renderAnnotationLayer
                  renderTextLayer
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
