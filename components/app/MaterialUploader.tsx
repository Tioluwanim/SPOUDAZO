"use client";

import { useRef, useState, DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import clsx from "clsx";
import { uploadMaterial } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Material } from "@/lib/types";

interface PendingFile {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function MaterialUploader({
  courseId,
  onUploaded,
}: {
  courseId: number;
  onUploaded: (material: Material) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [week, setWeek] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const weekNumber = week.trim() ? Number(week) : null;
    for (const file of Array.from(files)) {
      const id = `${file.name}-${Date.now()}`;
      setPending((prev) => [...prev, { id, name: file.name, status: "uploading" }]);
      try {
        const material = await uploadMaterial(courseId, file, weekNumber);
        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "done" } : p))
        );
        onUploaded(material);
        push(`${file.name} processed — ${material.chunk_count} chunks indexed`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "error", error: message } : p))
        );
        push(`${file.name} failed: ${message}`, "error");
      }
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-paper-faint">Week (optional):</label>
        <input
          type="number"
          min={1}
          max={20}
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          placeholder="e.g. 3"
          className="w-20 rounded-lg border border-ink-border bg-ink-surface px-2.5 py-1 text-sm text-paper focus-ring"
        />
        <span className="text-xs text-paper-faint">Leave blank for &quot;General&quot;</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors",
          dragOver
            ? "border-ai-accent bg-ai-accent/5"
            : "border-ink-border hover:border-paper-faint"
        )}
      >
        <UploadCloud size={28} className={dragOver ? "text-ai-accent" : "text-paper-faint"} />
        <p className="mt-4 text-sm text-paper">
          Drag a PDF, DOCX, or past-questions file here
        </p>
        <p className="mt-1 text-xs text-paper-faint">or click to browse — up to 50MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          <AnimatePresence>
            {pending.map((file) => (
              <motion.li
                key={file.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface/50 px-4 py-2.5 text-sm"
              >
                <FileText size={15} className="shrink-0 text-paper-faint" />
                <span className="flex-1 truncate text-paper-dim">{file.name}</span>
                {file.status === "uploading" && (
                  <Loader2 size={15} className="animate-spin text-ai-accent" />
                )}
                {file.status === "done" && (
                  <CheckCircle2 size={15} className="text-success" />
                )}
                {file.status === "error" && (
                  <span title={file.error} className="flex items-center gap-1 text-danger">
                    <XCircle size={15} />
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}