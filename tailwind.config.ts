import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        accent: "var(--accent)",
        state: {
          queued: "var(--state-queued)",
          running: "var(--state-running)",
          done: "var(--state-done)",
          retrying: "var(--state-retrying)",
          dead: "var(--state-dead)",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.72", transform: "scale(0.985)" },
        },
        "violet-flash": {
          "0%": { boxShadow: "0 0 0 0 rgba(155,123,240,0.0)" },
          "30%": { boxShadow: "0 0 0 3px rgba(155,123,240,0.55)" },
          "100%": { boxShadow: "0 0 0 0 rgba(155,123,240,0.0)" },
        },
      },
      animation: {
        breathe: "breathe 1.6s ease-in-out infinite",
        "violet-flash": "violet-flash 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
