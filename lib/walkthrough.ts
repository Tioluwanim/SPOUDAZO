/**
 * lib/walkthrough.ts - Step definitions for the interactive product tour
 * (components/app/Walkthrough.tsx). Kept separate from the engine so a
 * future feature tour is just a new array of WalkthroughStep objects, not
 * a new component.
 *
 * Each step names a *real* element already on the dashboard (via
 * data-tour="..." attributes on that element) rather than a page that
 * doesn't exist yet - AI-graded questions and per-course chat live inside
 * a course once one exists, so those get mentioned in the "Add course"
 * step's copy instead of a fabricated nav entry that isn't there.
 */

export interface WalkthroughStep {
  /** Matches a `data-tour="<id>"` attribute in the DOM. Omit for a centered, non-spotlit step (welcome/finish). */
  targetId?: string;
  title: string;
  body: string;
  /** Preferred side for the coach-mark card relative to the target. Falls back automatically if there's no room. */
  placement?: "top" | "bottom" | "left" | "right";
}

export const DASHBOARD_WALKTHROUGH: WalkthroughStep[] = [
  {
    title: "Welcome to Spoudazõ 👋",
    body: "A quick tour of how students here go from lecture PDFs to a revision plan that targets exactly what your lecturer keeps testing.",
  },
  {
    targetId: "add-course",
    title: "Start with a course",
    body: "Add a course, then upload your lecturer's PDFs inside it. Spoudazõ extracts the text, builds an AI search index, and gets everything ready for topic mining, question generation, and an AI tutor that only knows your own material.",
    placement: "bottom",
  },
  {
    targetId: "nav-library",
    title: "Smart Library",
    body: "Pick any topic to see what you've uploaded for it, alongside articles and explainers found around the web.",
    placement: "bottom",
  },
  {
    targetId: "nav-planner",
    title: "Study Planner",
    body: "Give it your exam date and study hours available - it schedules your weakest topics first, with links straight into practice.",
    placement: "bottom",
  },
  {
    targetId: "nav-progress",
    title: "Progress",
    body: "Mastery per topic, weak areas, and quiz history - pulled from your actual practice attempts, not self-reported confidence.",
    placement: "bottom",
  },
  {
    targetId: "feedback-button",
    title: "Something feels off?",
    body: "Report a bug or suggest a feature right here - it lands directly with the team, no WhatsApp message needed.",
    placement: "left",
  },
  {
    title: "You're all set",
    body: "Study smarter. Improve your GPA. Shock the lecturers.",
  },
];
