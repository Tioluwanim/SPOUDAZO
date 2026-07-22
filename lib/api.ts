import type {
  CBTAttemptResult,
  CBTQuestion,
  ChatTurn,
  Course,
  CourseChatResponse,
  Material,
  StudyPlan,
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
