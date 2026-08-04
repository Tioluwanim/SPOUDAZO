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
        // --- Luxury academic gold system (replaces the old navy/electric-blue
        // brand) ---
        //
        // `gold` is the single primary accent now: CTAs, links, active states,
        // the signature frequency-pulse visual, achievement/progress. One
        // accent family, three depths, used deliberately rather than several
        // competing brand colors.
        gold: {
          DEFAULT: "#C8A54B",   // primary gold - CTAs, active states, accents
          deep: "#B8860B",      // hover/pressed states, higher-contrast text-on-gold
          champagne: "#E8D7A5", // soft fills, subtle highlights, glows
        },
        // `navy` is kept only as a deep warm-ink tone for rare full-bleed dark
        // sections (e.g. the "why students love it" band) - it is no longer a
        // brand color, just a dark neutral that reads calmer than pure black
        // next to gold.
        navy: {
          DEFAULT: "#1C1712",
        },
        // Legacy token names kept so the rest of the app (dashboard, reader,
        // chat, etc.) re-themes to gold automatically without touching every
        // file - `ai-accent` and `achievement` now both resolve to the gold
        // family. New code should reach for `gold` directly.
        ai: {
          accent: "#C8A54B",
          "accent-deep": "#B8860B",
        },
        achievement: {
          DEFAULT: "#C8A54B",
          deep: "#B8860B",
        },
        // Success / Danger / Warning, AA-checked for text on the cream
        // (#FCFBF7) background.
        success: {
          DEFAULT: "#2E8B57",  // ~5.1:1 on cream
          bright: "#3FA968",
        },
        danger: {
          DEFAULT: "#C0392B",  // ~5.4:1 on cream
          bright: "#DD5240",
        },
        warning: {
          DEFAULT: "#B4670A",  // AA-safe text version of the spec's #D97706 (~3.4:1 fails on cream at #D97706 itself)
          bright: "#D97706",
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
        glow: "0 0 60px -12px rgba(200,165,75,0.45)",
        "ai-glow": "0 0 60px -12px rgba(200,165,75,0.45)",
        gold: "0 8px 24px -8px rgba(184,134,11,0.35)",
        "gold-lg": "0 20px 50px -16px rgba(184,134,11,0.4)",
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
