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

export function sendCourseChat(courseId: number, message: string, history: ChatTurn[] = []) {
  return request<CourseChatResponse>(`/courses/${courseId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
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
