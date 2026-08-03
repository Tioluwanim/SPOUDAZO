"use client";

import { useRequireAuth } from "@/lib/auth";
import { DocumentReader } from "@/components/reader/DocumentReader";

export default function DocumentReaderPage({
  params,
}: {
  params: { courseId: string; docId: string };
}) {
  const { user, loading: authLoading } = useRequireAuth();
  if (authLoading || !user) return null;

  return <DocumentReader courseId={Number(params.courseId)} docId={params.docId} />;
}
