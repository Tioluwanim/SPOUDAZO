"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import type { Topic } from "@/lib/types";

export function TopicCard({
  topic,
  courseId,
  maxFrequency,
  index = 0,
}: {
  topic: Topic;
  courseId: number;
  maxFrequency: number;
  index?: number;
}) {
  const pct = maxFrequency > 0 ? Math.max(8, (topic.frequency_score / maxFrequency) * 100) : 8;
  const isHot = maxFrequency > 0 && topic.frequency_score / maxFrequency >= 0.6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <Link href={`/courses/${courseId}/topics/${topic.id}`}>
        <Card className="group flex items-center gap-4 p-5 transition-colors hover:border-amber-glow/50">
          <div className="flex h-14 w-3 items-end overflow-hidden rounded-full bg-ink-border/60">
            <div
              className={`w-full rounded-full transition-all duration-500 ${
                isHot ? "bg-amber-glow" : "bg-paper-faint/60"
              }`}
              style={{ height: `${pct}%` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base text-paper">{topic.name}</h3>
            <p className="mt-1 font-mono text-xs text-paper-faint">
              frequency score · {topic.frequency_score}
            </p>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
