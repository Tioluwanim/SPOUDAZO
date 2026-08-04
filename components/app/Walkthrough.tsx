"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { WalkthroughStep } from "@/lib/walkthrough";

const STORAGE_KEY = "spoudazo:walkthrough_seen";
const MAX_CARD_WIDTH = 340;
const GAP = 16;
const SPOTLIGHT_PADDING = 8;

export function hasSeenWalkthrough(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function markWalkthroughSeen() {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "1");
}

/** First data-tour="<targetId>" element that's actually visible right now -
 * desktop and mobile nav both render every item, with only one of the two
 * shown at a given viewport width, so this skips whichever is display:none. */
function findVisibleTargetRect(targetId: string): DOMRect | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${targetId}"]`);
  for (const el of Array.from(els)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

function useTargetRect(targetId: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetId) {
      setRect(null);
      return;
    }

    const el = document.querySelector<HTMLElement>(`[data-tour="${targetId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });

    let frame = 0;
    let raf: number;
    const update = () => {
      setRect(findVisibleTargetRect(targetId));
      frame++;
      // ~40 frames (~0.6s @60fps) comfortably covers the smooth-scroll
      // settling window above; after that the listeners below take over.
      if (frame < 40) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    const onViewportChange = () => setRect(findVisibleTargetRect(targetId));
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange);
    };
  }, [targetId]);

  return rect;
}

type Placement = "top" | "bottom" | "left" | "right";

/** Picks the side the card actually fits on, rather than trusting the
 * step's configured placement blindly. This matters beyond just narrow
 * viewports: e.g. the mobile bottom nav sits flush against the bottom
 * edge of the screen, so a step configured as "bottom" for that target
 * has zero room below it regardless of how wide the viewport is - the
 * fix has to be "does this direction actually have room", not "is the
 * viewport narrow". */
function pickPlacement(
  rect: DOMRect,
  preferred: Placement | undefined,
  cardWidth: number,
  cardHeight: number,
  vw: number,
  vh: number
): Placement {
  const room: Record<Placement, number> = {
    top: rect.top - GAP,
    bottom: vh - rect.bottom - GAP,
    left: rect.left - GAP,
    right: vw - rect.right - GAP,
  };
  const needed: Record<Placement, number> = {
    top: cardHeight,
    bottom: cardHeight,
    left: cardWidth,
    right: cardWidth,
  };
  const fits = (p: Placement) => room[p] >= needed[p];

  if (preferred && fits(preferred)) return preferred;

  const order: Placement[] = ["bottom", "top", "right", "left"];
  const candidate = order.find(fits);
  if (candidate) return candidate;

  // Nothing truly fits (a very small viewport) - use whichever direction
  // has the most room. The clamping in cardStyle still keeps the card
  // fully on-screen either way, just tighter against the target.
  return order.reduce((best, p) => (room[p] > room[best] ? p : best), order[0]);
}

function cardStyle(
  rect: DOMRect | null,
  placement: WalkthroughStep["placement"],
  cardWidth: number,
  cardHeight: number
): CSSProperties {
  if (typeof window === "undefined") return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    // Centered step (welcome / finish) - no target to anchor to.
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const effectivePlacement = pickPlacement(rect, placement, cardWidth, cardHeight, vw, vh);
  const clampLeft = Math.max(GAP, Math.min(rect.left, vw - cardWidth - GAP));
  const clampTop = Math.max(GAP, Math.min(rect.top, vh - cardHeight - GAP));

  switch (effectivePlacement) {
    case "top":
      return { left: clampLeft, bottom: Math.max(GAP, vh - rect.top + GAP) };
    case "left":
      return { right: Math.max(GAP, vw - rect.left + GAP), top: clampTop };
    case "right":
      return { left: Math.min(rect.right + GAP, vw - cardWidth - GAP), top: clampTop };
    case "bottom":
    default:
      return { left: clampLeft, top: Math.min(rect.bottom + GAP, vh - cardHeight - GAP) };
  }
}

export function Walkthrough({
  steps,
  onClose,
}: {
  steps: WalkthroughStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const rect = useTargetRect(step.targetId);

  // Card width caps at MAX_CARD_WIDTH but shrinks to fit narrow viewports
  // instead of overflowing them; height is the real rendered height (text
  // length varies per step) rather than a guessed constant, so the
  // clamping math in cardStyle works off actual numbers.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : MAX_CARD_WIDTH + GAP * 2
  );
  const cardWidth = Math.min(MAX_CARD_WIDTH, viewportWidth - GAP * 2);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(220);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, cardWidth, step.title, step.body]);

  const finish = useCallback(() => {
    markWalkthroughSeen();
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [isLast, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, back, finish]);

  const padded = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Dimming layer - four bands around the spotlight cutout when there's
          a target, or one full-screen dim for centered welcome/finish steps. */}
      {padded ? (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-navy/70 backdrop-blur-[2px] transition-all duration-300"
            style={{ height: Math.max(0, padded.top) }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-navy/70 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: padded.top + padded.height }}
          />
          <div
            className="absolute bg-navy/70 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: padded.top, height: padded.height, left: 0, width: Math.max(0, padded.left) }}
          />
          <div
            className="absolute bg-navy/70 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: padded.top, height: padded.height, left: padded.left + padded.width, right: 0 }}
          />
          {/* Highlight ring around the spotlit element itself. */}
          <motion.div
            layout
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute rounded-xl ring-2 ring-ai-accent"
            style={{ top: padded.top, left: padded.left, width: padded.width, height: padded.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-navy/75 backdrop-blur-sm transition-all duration-300" />
      )}

      {/* Coach-mark card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="absolute overflow-y-auto rounded-2xl border border-ink-border bg-ink-soft/90 p-5 shadow-2xl backdrop-blur-xl"
          style={{
            width: cardWidth,
            maxHeight: `calc(100dvh - ${GAP * 2}px)`,
            ...cardStyle(rect, step.placement, cardWidth, cardHeight),
          }}
        >
          <button
            onClick={finish}
            aria-label="Close tour"
            className="absolute right-3 top-3 text-paper-faint transition-colors hover:text-paper focus-ring"
          >
            <XIcon size={15} />
          </button>

          <h3 className="mb-1.5 pr-5 font-display text-lg text-paper">{step.title}</h3>
          <p className="text-sm leading-relaxed text-paper-dim">{step.body}</p>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  i === index
                    ? "h-1.5 w-5 rounded-full bg-ai-accent transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-ink-border transition-all"
                }
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={finish}
              className="text-sm text-paper-faint transition-colors hover:text-paper-dim focus-ring"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button size="sm" variant="ghost" onClick={back}>
                  <ArrowLeft size={14} /> Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast ? "Start learning" : "Next"}
                {!isLast && <ArrowRight size={14} />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
