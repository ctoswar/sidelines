import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        card: "var(--card)",
        line: "var(--line)",
        brand: "var(--brand)",
        onbrand: "var(--onbrand)",
        flag: "var(--flag)",
        field: "var(--field)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        score: ["var(--font-score)", "'Arial Narrow'", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
