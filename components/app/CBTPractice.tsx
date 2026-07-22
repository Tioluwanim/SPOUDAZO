"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Sparkles, ChevronLeft, ChevronRight, Check, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/lib/settings";
import { generateCbtBatch, listCbtQuestions, submitCbtAttempt } from "@/lib/api";
import type { CBTAttemptResult, CBTQuestion } from "@/lib/types";

const SECONDS_PER_QUESTION = 60;

export function CBTPractice({ topicId }: { topicId: number }) {
  const [questions, setQuestions] = useState<CBTQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, CBTAttemptResult>>({});
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const { examMode } = useSettings();
  const { push } = useToast();

  useEffect(() => {
    listCbtQuestions(topicId)
      .then(setQuestions)
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load CBT questions", "error"))
      .finally(() => setLoading(false));
  }, [topicId, push]);

  // Exam mode: a fresh 60s countdown per question. Resets whenever the
  // visible question changes (advancing, going back, or a timeout firing
  // the auto-advance below) - not tied to whether it's answered, since a
  // real exam timer doesn't pause just because you've picked an answer.
  useEffect(() => {
    if (!examMode) return;
    setSecondsLeft(SECONDS_PER_QUESTION);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setIndex((i) => Math.min(i + 1, questions.length - 1));
          return SECONDS_PER_QUESTION;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examMode, index]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const batch = await generateCbtBatch(topicId, 5);
      setQuestions((prev) => [...prev, ...batch]);
      setIndex(questions.length);
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Couldn't generate CBT questions for this topic",
        "error"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleAnswer(question: CBTQuestion, option: string) {
    // Guard set synchronously, before the await - answers[question.id] only
    // exists once the response comes back, which left a window where two
    // rapid clicks (same option or two different ones) could both pass the
    // old check and fire two attempts for one question, double-counting
    // toward mastery. `pending` closes that window immediately on click.
    if (answers[question.id] || pending.has(question.id)) return;
    setPending((prev) => new Set(prev).add(question.id));
    try {
      const result = await submitCbtAttempt(question.id, option);
      setAnswers((prev) => ({ ...prev, [question.id]: result }));
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't submit that answer", "error");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(question.id);
        return next;
      });
    }
  }

  if (loading) return <Spinner label="Loading CBT questions…" />;

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No CBT questions yet"
        body="Generate a batch of multiple-choice questions grounded in this topic's source material."
        action={
          <Button onClick={handleGenerate} loading={generating}>
            Generate 5 questions
          </Button>
        }
      />
    );
  }

  const question = questions[index];
  const answered = answers[question.id];
  const correctCount = Object.values(answers).filter((a) => a.is_correct).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-xs text-paper-faint">
          Question {index + 1} of {questions.length} · {correctCount} correct so far
        </span>
        <div className="flex items-center gap-3">
          {examMode && (
            <span
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs",
                secondsLeft <= 10
                  ? "border-clay-alert/50 text-clay-alert"
                  : "border-ink-border text-paper-dim"
              )}
            >
              <Clock size={12} />
              {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={handleGenerate} loading={generating}>
            <Sparkles size={14} /> Generate 5 more
          </Button>
        </div>
      </div>

      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <p className="font-display text-lg leading-snug text-paper">{question.prompt}</p>
            <span className="shrink-0 rounded-full border border-ink-border px-2.5 py-1 font-mono text-[11px] uppercase text-paper-faint">
              {question.difficulty}
            </span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(question.options).map(([key, label]) => {
              const isSelectedCorrect =
                answered && answered.is_correct && key === answered.correct_answer;
              const isSelectedWrong =
                answered && !answered.is_correct && key === answered.correct_answer;
              const isWrongPick =
                answered && !answered.is_correct && key !== answered.correct_answer;

              return (
                <button
                  key={key}
                  onClick={() => handleAnswer(question, key)}
                  disabled={!!answered || pending.has(question.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-ring",
                    !answered && "border-ink-border text-paper-dim hover:border-amber-glow/50 hover:text-paper",
                    isSelectedCorrect && "border-teal-mastery bg-teal-mastery/10 text-paper",
                    isSelectedWrong && "border-teal-mastery bg-teal-mastery/5 text-paper-dim",
                    isWrongPick && "border-clay-alert/60 bg-clay-alert/5 text-paper-dim"
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs">
                    {key}
                  </span>
                  <span className="flex-1">{label}</span>
                  {isSelectedCorrect && <Check size={16} className="text-teal-mastery" />}
                  {isWrongPick && <X size={16} className="text-clay-alert" />}
                </button>
              );
            })}
          </div>

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx(
                "mt-4 rounded-xl border p-4 text-sm",
                answered.is_correct
                  ? "border-teal-mastery/40 bg-teal-mastery/5 text-paper-dim"
                  : "border-clay-alert/40 bg-clay-alert/5 text-paper-dim"
              )}
            >
              <p className="mb-1 font-medium text-paper">
                {answered.is_correct ? "Correct." : `Correct answer: ${answered.correct_answer}`}
              </p>
              {answered.explanation && <p>{answered.explanation}</p>}
            </motion.div>
          )}
        </Card>
      </motion.div>

      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft size={15} /> Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
        >
          Next <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
