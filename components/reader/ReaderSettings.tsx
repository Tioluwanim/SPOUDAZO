"use client";

import { useState } from "react";
import { Settings, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const ZOOM_STEP = 10;
const ZOOM_MIN = 80;
const ZOOM_MAX = 150;
const ZOOM_DEFAULT = 100;

export function ReaderSettings({ zoom, onZoomChange }: { zoom: number; onZoomChange: (zoom: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Reading settings"
        aria-expanded={open}
        className={`rounded-lg p-1.5 hover:bg-ink-border focus-ring ${open ? "text-ai-accent" : "text-paper-dim hover:text-paper"}`}
      >
        <Settings size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-ink-border bg-ink-soft p-3 shadow-xl">
          <p className="mb-2 text-xs font-medium text-paper-dim">Text size</p>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
              aria-label="Decrease text size"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-paper-faint">{zoom}%</span>
            <button
              onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
              aria-label="Increase text size"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => onZoomChange(ZOOM_DEFAULT)}
              aria-label="Reset text size"
              className="rounded-lg p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
