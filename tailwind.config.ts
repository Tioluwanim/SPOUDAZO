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
        // Accent colors stay constant across light/dark - accents keeping
        // their identity is what makes them feel like "the brand," not
        // just whatever the current background happens to be.
        amber: {
          glow: "#00B4D8",
          deep: "#0090AD",
        },
        gold: {
          DEFAULT: "#FFD700",
          deep: "#E6C200",
        },
        teal: {
          mastery: "#1D8A73",
        },
        clay: {
          alert: "#C2492E",
        },
        navy: {
          DEFAULT: "#0A192F",
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
        glow: "0 0 60px -12px rgba(0,180,216,0.35)",
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
