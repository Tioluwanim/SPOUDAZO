/**
 * lib/feedbackContext.ts - Passively captures the technical context a
 * bug report would otherwise require the student to type out by hand:
 * recent console errors, recent failed network requests, and a session
 * id that ties a report back to "everything that happened this visit."
 *
 * Patches console.error and window.fetch once, at module load, and
 * keeps only the last few of each in memory (ring buffers) - this file
 * is imported once from the root layout via FeedbackButton, so the
 * patching happens exactly once regardless of how many times the
 * button re-renders.
 */

const MAX_ENTRIES = 8;

const recentConsoleErrors: string[] = [];
const recentNetworkFailures: string[] = [];

function pushCapped(list: string[], entry: string) {
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.shift();
}

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "spoudazo:feedback-session-id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "unavailable";
  }
}

let patched = false;

/** Idempotent - safe to call from every FeedbackButton mount. */
export function initFeedbackContextCapture() {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
        .join(" ");
      pushCapped(recentConsoleErrors, message.slice(0, 500));
    } catch {
      // Never let capture itself throw inside the console.error patch.
    }
    originalConsoleError(...args);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "unknown";
    try {
      const res = await originalFetch(...args);
      if (!res.ok) {
        pushCapped(recentNetworkFailures, `${res.status} ${url}`);
      }
      return res;
    } catch (err) {
      pushCapped(recentNetworkFailures, `network error ${url}`);
      throw err;
    }
  };
}

/** IDs from the current route path, e.g. /courses/12/topics/34 -> {course_id: "12", topic_id: "34"}. */
function idsFromPathname(pathname: string): { course_id?: string; topic_id?: string } {
  const courseMatch = pathname.match(/\/courses\/([^/]+)/);
  const topicMatch = pathname.match(/\/topics\/([^/]+)/);
  return {
    course_id: courseMatch?.[1],
    topic_id: topicMatch?.[1],
  };
}

export function captureFeedbackContext(pathname: string) {
  const { course_id, topic_id } = idsFromPathname(pathname);
  return {
    page: typeof document !== "undefined" ? document.title : "",
    route: pathname,
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    os: typeof navigator !== "undefined" ? navigator.platform : "unknown",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown",
    screen_resolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "unknown",
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    request_id: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    course_id,
    topic_id,
    recent_console_errors: [...recentConsoleErrors],
    recent_network_failures: [...recentNetworkFailures],
  };
}
