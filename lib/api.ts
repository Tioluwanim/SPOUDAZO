import type {
  Annotation,
  AnnotationKind,
  Bookmark,
  CBTAttemptResult,
  CBTQuestion,
  ChatTurn,
  Course,
  CourseChatResponse,
  Feedback,
  FeedbackCategory,
  FeedbackSeverity,
  Material,
  MaterialDetail,
  RecentDocument,
  ReadingStats,
  StudyPlan,
  TextAction,
  TextActionResult,
  TheoryAttemptResult,
  TheoryQuestion,
  Topic,
  TopicResource,
  WeakArea,
} from "./types";
import { getIdToken } from "./firebase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    throw new ApiRequestError(401, "You're signed out. Please sign in again.");
  }

  const headers: HeadersInit =
    init?.body instanceof FormData
      ? { Authorization: `Bearer ${token}`, ...(init?.headers || {}) }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError(
      0,
      "Couldn't reach the Spoudazõ server. Check that the backend is running and NEXT_PUBLIC_API_URL is correct."
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiRequestError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Courses ──────────────────────────────────────────────────────────────

export function createCourse(name: string, code: string) {
  return request<Course>("/courses", {
    method: "POST",
    body: JSON.stringify({ name, code }),
  });
}

export function listCourses() {
  return request<Course[]>("/courses");
}

export function getCourse(courseId: number) {
  return request<Course>(`/courses/${courseId}`);
}

// ── Materials ────────────────────────────────────────────────────────────

export function uploadMaterial(courseId: number, file: File, weekNumber?: number | null) {
  const form = new FormData();
  form.append("file", file);
  if (weekNumber != null) form.append("week_number", String(weekNumber));
  return request<Material>(`/courses/${courseId}/materials`, {
    method: "POST",
    body: form,
  });
}

export function listMaterials(courseId: number) {
  return request<Material[]>(`/courses/${courseId}/materials`);
}

export function getMaterialDetail(courseId: number, docId: string) {
  return request<MaterialDetail>(`/courses/${courseId}/materials/${docId}`);
}

export function deleteMaterial(courseId: number, docId: string) {
  return request<void>(`/courses/${courseId}/materials/${docId}`, {
    method: "DELETE",
  });
}

// ── Reader: annotations, favorites, progress, AI actions ───────────────────

export function createAnnotation(
  courseId: number,
  docId: string,
  kind: AnnotationKind,
  sectionIndex: number,
  quote: string,
  note?: string
) {
  return request<Annotation>(`/courses/${courseId}/materials/${docId}/annotations`, {
    method: "POST",
    body: JSON.stringify({ kind, section_index: sectionIndex, quote, note }),
  });
}

export function listAnnotations(courseId: number, docId: string, kind?: AnnotationKind) {
  const qs = kind ? `?kind=${kind}` : "";
  return request<Annotation[]>(`/courses/${courseId}/materials/${docId}/annotations${qs}`);
}

export function deleteAnnotation(courseId: number, docId: string, annotationId: number) {
  return request<void>(`/courses/${courseId}/materials/${docId}/annotations/${annotationId}`, {
    method: "DELETE",
  });
}

export function toggleFavorite(courseId: number, docId: string) {
  return request<{ doc_id: string; favorited: boolean }>(
    `/courses/${courseId}/materials/${docId}/favorite`,
    { method: "POST" }
  );
}

export function getReadingProgress(courseId: number, docId: string) {
  return request<{ doc_id: string; last_section_index: number; progress_percent: number; last_viewed_at: string } | null>(
    `/courses/${courseId}/materials/${docId}/progress`
  );
}

export function updateReadingProgress(
  courseId: number,
  docId: string,
  lastSectionIndex: number,
  progressPercent: number,
  secondsDelta = 0
) {
  return request<{ doc_id: string; last_section_index: number; progress_percent: number; last_viewed_at: string }>(
    `/courses/${courseId}/materials/${docId}/progress`,
    {
      method: "PUT",
      body: JSON.stringify({
        last_section_index: lastSectionIndex,
        progress_percent: progressPercent,
        seconds_delta: secondsDelta,
      }),
    }
  );
}

export function runTextAction(
  courseId: number,
  docId: string,
  action: TextAction,
  selectedText: string,
  sectionTitle?: string,
  targetLanguage?: string
) {
  return request<TextActionResult>(`/courses/${courseId}/materials/${docId}/text-action`, {
    method: "POST",
    body: JSON.stringify({
      action,
      selected_text: selectedText,
      section_title: sectionTitle || "",
      target_language: targetLanguage || "",
    }),
  });
}

// Thumbnails are served from an auth-protected endpoint - see
// components/app/AuthedThumbnail.tsx, which fetches with the Bearer token
// and hands back an object URL, rather than a plain URL string here that
// a raw <img src> couldn't actually load.

// ── Smart Library (cross-course) ────────────────────────────────────────────

export function listRecentDocuments(limit = 10) {
  return request<RecentDocument[]>(`/library/recent?limit=${limit}`);
}

export function listAllBookmarks(limit = 50) {
  return request<Bookmark[]>(`/library/bookmarks?limit=${limit}`);
}

export function listFavoriteDocuments() {
  return request<RecentDocument[]>(`/library/favorites`);
}

export function getReadingAnalytics() {
  return request<ReadingStats>(`/library/analytics`);
}

/** The download endpoint requires auth, so a plain <a href download> can't
 * carry the Bearer token (same reason AuthedThumbnail exists) - this
 * fetches the bytes itself and triggers the browser's save dialog via a
 * temporary object URL. */
export async function downloadOriginalFile(courseId: number, docId: string, filename: string): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new ApiRequestError(401, "You're signed out. Please sign in again.");

  const res = await fetch(`${BASE_URL}/courses/${courseId}/materials/${docId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiRequestError(res.status, "Couldn't download this file");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Topics ───────────────────────────────────────────────────────────────

export function extractTopics(courseId: number) {
  return request<Topic[]>(`/courses/${courseId}/topics/extract`, {
    method: "POST",
  });
}

export function listTopics(courseId: number) {
  return request<Topic[]>(`/courses/${courseId}/topics`);
}

// ── Questions ────────────────────────────────────────────────────────────

export function generateTheoryQuestion(topicId: number) {
  return request<TheoryQuestion>(`/topics/${topicId}/questions/theory/generate`, {
    method: "POST",
  });
}

export function listTheoryQuestions(topicId: number) {
  return request<TheoryQuestion[]>(`/topics/${topicId}/questions/theory`);
}

export function generateCbtBatch(topicId: number, n = 5) {
  return request<CBTQuestion[]>(`/topics/${topicId}/questions/cbt/generate?n=${n}`, {
    method: "POST",
  });
}

export function listCbtQuestions(topicId: number) {
  return request<CBTQuestion[]>(`/topics/${topicId}/questions/cbt`);
}

// ── Attempts ─────────────────────────────────────────────────────────────

export function submitTheoryAttempt(questionId: number, studentAnswer: string) {
  return request<TheoryAttemptResult>(`/questions/${questionId}/theory-attempts`, {
    method: "POST",
    body: JSON.stringify({ student_answer: studentAnswer }),
  });
}

export function submitCbtAttempt(questionId: number, selectedOption: string) {
  return request<CBTAttemptResult>(`/questions/${questionId}/cbt-attempts`, {
    method: "POST",
    body: JSON.stringify({ selected_option: selectedOption }),
  });
}

export function getWeakAreas(courseId: number, limit = 10) {
  return request<WeakArea[]>(`/courses/${courseId}/weak-areas?limit=${limit}`);
}

export function sendCourseChat(
  courseId: number,
  message: string,
  history: ChatTurn[] = [],
  currentDocId?: string,
  currentSectionIndex?: number
) {
  return request<CourseChatResponse>(`/courses/${courseId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      message,
      history,
      current_doc_id: currentDocId,
      current_section_index: currentSectionIndex,
    }),
  });
}

/**
 * Streaming variant of sendCourseChat - consumes the SSE endpoint via
 * fetch (not EventSource, which can't attach the Authorization header
 * this endpoint requires). Calls onToken as each chunk arrives so the UI
 * can render the answer incrementally instead of waiting for the whole
 * thing, then onDone with the final metadata (sources/grounding, sent as
 * the stream's first event since grounding is decided before generation
 * starts).
 */
export async function streamCourseChat(
  courseId: number,
  message: string,
  history: ChatTurn[],
  handlers: {
    onMeta?: (meta: { sources: string[]; grounding: CourseChatResponse["grounding"] }) => void;
    onToken: (text: string) => void;
    onDone?: () => void;
    onError?: (message: string) => void;
  },
  currentDocId?: string,
  currentSectionIndex?: number
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new ApiRequestError(401, "You're signed out. Please sign in again.");

  const res = await fetch(`${BASE_URL}/courses/${courseId}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message,
      history,
      current_doc_id: currentDocId,
      current_section_index: currentSectionIndex,
    }),
  });

  if (!res.ok || !res.body) {
    throw new ApiRequestError(res.status, "Couldn't reach the study assistant");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; each frame is
    // "event: <name>\ndata: <json>".
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || ""; // last piece may be incomplete - keep it for the next read

    for (const frame of frames) {
      const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice("event:".length).trim();
      const data = dataLine.slice("data:".length).trim();

      if (event === "meta") handlers.onMeta?.(JSON.parse(data));
      else if (event === "token") handlers.onToken(JSON.parse(data).text);
      else if (event === "error") handlers.onError?.(JSON.parse(data).message);
      else if (event === "done") handlers.onDone?.();
    }
  }
}

// ── Study Planner ─────────────────────────────────────────────────────────

export function createStudyPlan(courseId: number, examDate: string, hoursPerDay: number) {
  return request<StudyPlan>(`/courses/${courseId}/study-plan`, {
    method: "POST",
    body: JSON.stringify({ exam_date: examDate, hours_per_day: hoursPerDay }),
  });
}

export function getStudyPlan(courseId: number) {
  return request<StudyPlan | null>(`/courses/${courseId}/study-plan`);
}

export function setStudyPlanItemCompleted(itemId: number, completed: boolean) {
  return request(`/study-plan-items/${itemId}/complete?completed=${completed}`, {
    method: "PATCH",
  });
}

// ── Smart Library online resources ────────────────────────────────────────

export function getTopicResources(topicId: number) {
  return request<TopicResource[]>(`/topics/${topicId}/resources`);
}

export function refreshTopicResources(topicId: number) {
  return request<TopicResource[]>(`/topics/${topicId}/resources/refresh`, {
    method: "POST",
  });
}

// ── Feedback ─────────────────────────────────────────────────────────────

export async function uploadFeedbackScreenshot(blob: Blob): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new ApiRequestError(401, "You're signed out. Please sign in again.");

  const form = new FormData();
  form.append("file", blob, "screenshot.png");

  const res = await fetch(`${BASE_URL}/feedback/screenshot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new ApiRequestError(res.status, "Couldn't upload the screenshot");
  }
  const data = await res.json();
  return data.screenshot_url as string;
}

export function submitFeedback(payload: {
  category: FeedbackCategory;
  title: string;
  description: string;
  expected_behavior?: string;
  actual_behavior?: string;
  severity: FeedbackSeverity;
  screenshot_url?: string | null;
  metadata: Record<string, unknown>;
}) {
  return request<Feedback>("/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
