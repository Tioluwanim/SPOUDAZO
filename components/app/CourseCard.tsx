"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Course } from "@/lib/types";

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/courses/${course.id}`}>
        <Card className="group p-6 transition-colors hover:border-amber-glow/50">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-amber-glow">
                {course.code}
              </p>
              <h3 className="mt-2 font-display text-xl text-paper">{course.name}</h3>
            </div>
            <ArrowUpRight
              size={18}
              className="text-paper-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-glow"
            />
          </div>
          <p className="mt-6 text-xs text-paper-faint">
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
