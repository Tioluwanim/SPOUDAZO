export type Register = "formal" | "coursemate" | "pidgin";

export interface Course {
  id: number;
  name: string;
  code: string;
  created_at: string;
}

export interface Material {
  doc_id: string;
  filename: string;
  status: string;
  chunk_count: number;
  week_number: number | null;
}

export interface Topic {
  id: number;
  name: string;
  frequency_score: number;
}

export interface TheoryQuestion {
  id: number;
  topic_id: number;
  prompt: string;
  difficulty: string;
}

export interface CBTQuestion {
  id: number;
  topic_id: number;
  prompt: string;
  options: Record<string, string>;
  difficulty: string;
}

export interface GapDetail {
  point: string;
  reason: string;
}

export interface TheoryAttemptResult {
  score: number;
  max_score: number;
  gaps: GapDetail[];
}

export interface CBTAttemptResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
}

export interface WeakArea {
  topic_id: number;
  name: string;
  mastery_score: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CourseChatResponse {
  answer: string;
  sources: string[];
  grounding: "notes" | "notes+web" | "web" | "general";
}

export interface StudyPlanItem {
  id: number;
  topic_id: number;
  topic_name: string;
  scheduled_date: string;
  completed: boolean;
}

export interface StudyPlan {
  id: number;
  exam_date: string;
  hours_per_day: number;
  compressed: boolean;
  items: StudyPlanItem[];
}

export interface TopicResource {
  title: string;
  url: string;
  snippet: string | null;
  source_domain: string | null;
}

export interface ApiError {
  status: number;
  detail: string;
}

// ── Feedback ─────────────────────────────────────────────────────────────

export type FeedbackCategory =
  | "bug"
  | "feature"
  | "performance"
  | "ai_response"
  | "ui_ux"
  | "study_plan"
  | "question_generation"
  | "other";

export type FeedbackSeverity = "low" | "medium" | "high" | "critical";

export type FeedbackStatus = "new" | "open" | "in_progress" | "resolved" | "closed";

export interface FeedbackContext {
  page: string;
  route: string;
  browser: string;
  os: string;
  viewport: string;
  screen_resolution: string;
  app_version: string;
  timestamp: string;
  session_id: string;
  request_id: string;
  course_id?: string | null;
  topic_id?: string | null;
  recent_console_errors: string[];
  recent_network_failures: string[];
}

export interface Feedback {
  id: number;
  reference_id: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  expected_behavior: string | null;
  actual_behavior: string | null;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  priority: string | null;
  screenshot_url: string | null;
  metadata: Partial<FeedbackContext>;
  created_at: string;
  updated_at: string;
}
