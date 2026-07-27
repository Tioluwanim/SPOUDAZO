"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Camera, X as XIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { submitFeedback, uploadFeedbackScreenshot } from "@/lib/api";
import { captureFeedbackContext } from "@/lib/feedbackContext";
import type { FeedbackCategory, FeedbackSeverity } from "@/lib/types";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "performance", label: "Performance" },
  { value: "ai_response", label: "AI Response" },
  { value: "ui_ux", label: "UI / UX" },
  { value: "study_plan", label: "Study Plan" },
  { value: "question_generation", label: "Question Generation" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: FeedbackSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const inputClass =
  "w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-faint focus-ring";

export function FeedbackModal({
  open,
  onClose,
  initialCategory,
}: {
  open: boolean;
  onClose: () => void;
  initialCategory?: FeedbackCategory;
}) {
  const pathname = usePathname();
  const { push } = useToast();

  const [category, setCategory] = useState<FeedbackCategory>(initialCategory || "bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCategory(initialCategory || "bug");
    setTitle("");
    setDescription("");
    setExpectedBehavior("");
    setActualBehavior("");
    setSeverity("medium");
    setScreenshotPreview(null);
    setScreenshotBlob(null);
  }

  async function handleCaptureScreenshot() {
    setCapturingScreenshot(true);
    try {
      // Dynamically imported - only ever loaded when a student actually
      // chooses to attach a screenshot, not on every page that mounts
      // the feedback button.
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        backgroundColor: null,
        logging: false,
        // Modal itself is fixed/overlaid - excluding it keeps the
        // screenshot focused on the page the student is reporting on.
        ignoreElements: (el) => el.getAttribute("data-feedback-modal") === "true",
      });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.9));
      if (!blob) throw new Error("Couldn't render a screenshot");
      setScreenshotBlob(blob);
      setScreenshotPreview(URL.createObjectURL(blob));
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't capture a screenshot", "error");
    } finally {
      setCapturingScreenshot(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (screenshotBlob) {
        screenshotUrl = await uploadFeedbackScreenshot(screenshotBlob);
      }

      const context = captureFeedbackContext(pathname || "");
      const feedback = await submitFeedback({
        category,
        title: title.trim(),
        description: description.trim(),
        expected_behavior: expectedBehavior.trim() || undefined,
        actual_behavior: actualBehavior.trim() || undefined,
        severity,
        screenshot_url: screenshotUrl,
        metadata: context,
      });

      push(`Thank you! Your feedback has been received. Reference: ${feedback.reference_id}`);
      reset();
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send your feedback - please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-feedback-modal="true">
      <Modal open={open} onClose={handleClose} title="Send feedback">
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-ring",
                    category === c.value
                      ? "bg-navy text-white"
                      : "border border-ink-border text-paper-dim hover:border-navy/40"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className={clsx(inputClass, "resize-none")}
            />
          </div>

          {category === "bug" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-paper-dim">Expected behaviour</label>
                <textarea
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  rows={2}
                  className={clsx(inputClass, "resize-none")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-paper-dim">Actual behaviour</label>
                <textarea
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  rows={2}
                  className={clsx(inputClass, "resize-none")}
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Severity</label>
            <div className="flex gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={clsx(
                    "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-ring",
                    severity === s.value
                      ? "bg-navy text-white"
                      : "border border-ink-border text-paper-dim hover:border-navy/40"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-paper-dim">Screenshot (optional)</label>
            {screenshotPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-ink-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotPreview} alt="Screenshot preview" className="max-h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setScreenshotPreview(null);
                    setScreenshotBlob(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-ink/80 p-1.5 text-paper hover:bg-ink focus-ring"
                  aria-label="Remove screenshot"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCaptureScreenshot}
                disabled={capturingScreenshot}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-border py-3 text-sm text-paper-dim hover:border-navy/40 hover:text-paper focus-ring disabled:opacity-50"
              >
                <Camera size={16} />
                {capturingScreenshot ? "Capturing…" : "Attach a screenshot of this page"}
              </button>
            )}
          </div>

          <p className="text-xs text-paper-faint">
            Your page, browser, and recent errors are attached automatically - you don&apos;t need to describe them.
          </p>

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={!title.trim() || !description.trim()}
          >
            Send feedback
          </Button>
        </form>
      </Modal>
    </div>
  );
}
