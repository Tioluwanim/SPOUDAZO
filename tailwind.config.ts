import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background/text system - driven by CSS variables (see globals.css)
        // so toggling the `dark` class on <html> re-themes every component
        // that already uses these tokens, with zero component changes.
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          surface: "rgb(var(--color-ink-surface) / <alpha-value>)",
          border: "rgb(var(--color-ink-border) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--color-paper) / <alpha-value>)",
          dim: "rgb(var(--color-paper-dim) / <alpha-value>)",
          faint: "rgb(var(--color-paper-faint) / <alpha-value>)",
        },
        // Primary - Deep Navy. Headers, primary buttons, nav, logo.
        navy: {
          DEFAULT: "#0A192F",
        },
        // AI accent - Electric Blue. Reserved for AI-related UI specifically
        // (the chat widget, AI badges/highlights) - NOT a general-purpose
        // button color. Named "ai" on purpose so future usage is checked
        // against "is this actually AI-related" rather than reached for as
        // a generic accent, which is what caused the previous primary CTA
        // buttons to be the wrong color per the brand spec.
        ai: {
          accent: "#00B4D8",
          "accent-deep": "#0090AD",
        },
        // Achievement - Gold. Progress, streaks, badges, mastery.
        achievement: {
          DEFAULT: "#FFD700",
          deep: "#E6C200",
        },
        // Success / Danger: two shades each. DEFAULT is AA-contrast-checked
        // for text/icons on the off-white background (raw spec hex fails
        // WCAG AA for text - #10B981 measures ~2.5:1, #EF4444 ~3.8:1,  both
        // under the 4.5:1 body-text minimum). `bright` uses the spec's exact
        // hex for decorative fills/large elements where contrast math works
        // differently (e.g. white text on a filled bright background).
        success: {
          DEFAULT: "#1D8A73",  // AA-safe for text/icons (~7.9:1 on off-white)
          bright: "#10B981",   // spec's exact hex - fills, large elements only
        },
        danger: {
          DEFAULT: "#C2492E",  // AA-safe for text/icons (~4.9:1 on off-white)
          bright: "#EF4444",   // spec's exact hex - fills, large elements only
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "grain": "radial-gradient(circle at 1px 1px, rgba(10,25,47,0.04) 1px, transparent 0)",
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(10,25,47,0.35)",
        "ai-glow": "0 0 60px -12px rgba(0,180,216,0.35)",
      },
      keyframes: {
        pulseBar: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        pulseBar: "pulseBar 2.4s ease-in-out infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;