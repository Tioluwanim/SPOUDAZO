"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, CircleAlert, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/lib/settings";
import { useTaskProgress } from "@/lib/useTaskProgress";
import {
  generateTheoryQuestion,
  listTheoryQuestions,
  submitTheoryAttempt,
} from "@/lib/api";
import type { TheoryAttemptResult, TheoryQuestion } from "@/lib/types";

const THEORY_SECONDS = 10 * 60; // 10 minutes per question, once the student starts answering

export function TheoryPractice({ topicId }: { topicId: number }) {
  const [questions, setQuestions] = useState<TheoryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();
  const generateTask = useTaskProgress("theory_question_generate", 10, "Generating theory question…");

  useEffect(() => {
    listTheoryQuestions(topicId)
      .then(setQuestions)
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load questions", "error"))
      .finally(() => setLoading(false));
  }, [topicId, push]);

  async function handleGenerate() {
    const q = await generateTask.run(() => generateTheoryQuestion(topicId));
    if (q) setQuestions((prev) => [q, ...prev]);
  }

  if (loading) return <Spinner label="Loading theory questions…" />;

  return (
    <div>
      <div className="mb-5 flex flex-col items-end gap-2">
        <Button size="sm" variant="outline" onClick={handleGenerate} loading={generateTask.status === "running"}>
          <Sparkles size={14} /> Generate question
        </Button>
        {generateTask.status !== "idle" && (
          <div className="w-full max-w-xs">
            <TaskProgress
              status={generateTask.status}
              step={generateTask.step}
              progressPercent={generateTask.progressPercent}
              etaLabel={generateTask.etaLabel}
              errorMessage={generateTask.errorMessage}
              onRetry={generateTask.retry}
              compact
            />
          </div>
        )}
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No theory questions yet"
          body="Generate one — it'll come with a rubric graded point-by-point against your answer."
          action={
            <Button onClick={handleGenerate} loading={generateTask.status === "running"}>
              Generate question
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <TheoryQuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function TheoryQuestionCard({ question }: { question: TheoryQuestion }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<TheoryAttemptResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(THEORY_SECONDS);
  const [timedOut, setTimedOut] = useState(false);
  const timerStarted = useRef(false);
  const { examMode } = useSettings();
  const markingTask = useTaskProgress("theory_ai_marking", 8, "Evaluating answer…");

  async function handleSubmit() {
    if (!answer.trim()) return;
    const r = await markingTask.run(() => submitTheoryAttempt(question.id, answer.trim()));
    if (r) setResult(r);
  }

  // Exam mode: the clock starts on the student's first keystroke for THIS
  // question, not when the card mounts - all generated questions render
  // in one stacked list at once, so an on-mount timer would start ticking
  // for every question simultaneously regardless of which one the student
  // is actually working on.
  useEffect(() => {
    if (!examMode || !timerStarted.current || result) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTimedOut(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [examMode, timerStarted.current, result]);

  useEffect(() => {
    if (timedOut && answer.trim() && !result) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  function handleChange(value: string) {
    if (examMode && !timerStarted.current && value.trim()) {
      timerStarted.current = true;
    }
    setAnswer(value);
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-display text-lg leading-snug text-paper">{question.prompt}</p>
        <span className="shrink-0 rounded-full border border-ink-border px-2.5 py-1 font-mono text-[11px] uppercase text-paper-faint">
          {question.difficulty}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        {examMode && !result && (
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
              timedOut
                ? "border-danger/50 text-danger"
                : secondsLeft <= 60 && timerStarted.current
                ? "border-danger/50 text-danger"
                : "border-ink-border text-paper-dim"
            }`}
          >
            <Clock size={12} />
            {timerStarted.current
              ? `${String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
              : "Timer starts when you begin typing"}
          </span>
        )}
      </div>

      <textarea
        value={answer}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!!result || (timedOut && !answer.trim())}
        rows={4}
        placeholder="Write your answer…"
        className="w-full resize-none rounded-xl border border-ink-border bg-ink px-4 py-3 text-sm text-paper placeholder:text-paper-faint focus-ring disabled:opacity-60"
      />

      {timedOut && !result && !answer.trim() && (
        <p className="mt-2 text-sm text-danger">Time&apos;s up — no answer was submitted.</p>
      )}

      {!result && (
        <div className="mt-3 flex flex-col items-end gap-2">
          <Button size="sm" onClick={handleSubmit} loading={markingTask.status === "running"} disabled={!answer.trim()}>
            <Send size={14} /> Submit answer
          </Button>
          {markingTask.status !== "idle" && (
            <div className="w-full max-w-xs">
              <TaskProgress
                status={markingTask.status}
                step={markingTask.step}
                progressPercent={markingTask.progressPercent}
                etaLabel={markingTask.etaLabel}
                errorMessage={markingTask.errorMessage}
                onRetry={markingTask.retry}
                compact
              />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border border-ink-border bg-ink/60 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-paper-dim">Score</span>
              <span className="font-mono text-lg text-ai-accent">
                {result.score} / {result.max_score}
              </span>
            </div>
            {result.gaps.length > 0 ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm text-paper-dim">
                  <CircleAlert size={14} className="text-danger" />
                  What your answer missed
                </p>
                <ul className="space-y-2.5">
                  {result.gaps.map((gap, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-0.5 text-danger">·</span>
                      <div>
                        <span className="font-medium text-paper">{gap.point}</span>
                        <p className="text-paper-dim">{gap.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-success">Full marks — nothing missing.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
