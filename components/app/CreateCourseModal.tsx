"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createCourse } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Course } from "@/lib/types";

export function CreateCourseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    try {
      const course = await createCourse(name.trim(), code.trim().toUpperCase());
      push(`${course.code} created`);
      setName("");
      setCode("");
      onCreated(course);
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create the course", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a course">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-paper-dim">Course code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CPE 316"
            className="w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-paper placeholder:text-paper-faint focus-ring"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-paper-dim">Course name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Artificial Intelligence"
            className="w-full rounded-xl border border-ink-border bg-ink px-4 py-2.5 text-paper placeholder:text-paper-faint focus-ring"
          />
        </div>
        <Button type="submit" className="w-full" loading={loading} disabled={!name.trim() || !code.trim()}>
          Create course
        </Button>
      </form>
    </Modal>
  );
}
