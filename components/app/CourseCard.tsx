"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BookMarked } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Course } from "@/lib/types";

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
    >
      <Link href={`/courses/${course.id}`}>
        <Card className="group relative overflow-hidden p-6 transition-all hover:border-gold/40 hover:shadow-gold">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/0 blur-2xl transition-colors duration-500 group-hover:bg-gold/15" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-deep">
                <BookMarked size={16} />
              </span>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-gold-deep">
                  {course.code}
                </p>
                <h3 className="mt-1.5 font-display text-xl text-paper">{course.name}</h3>
              </div>
            </div>
            <ArrowUpRight
              size={18}
              className="shrink-0 text-paper-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-deep"
            />
          </div>
          <p className="relative mt-6 text-xs text-paper-faint">
            Added {new Date(course.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </Card>
      </Link>
    </motion.div>
  );
}
