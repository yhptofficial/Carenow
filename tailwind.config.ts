import type { Config } from "tailwindcss";

/**
 * CareNow design tokens.
 *
 * Every value here maps 1:1 to the CareNow style guide. Screens should compose
 * these tokens (`bg-surface`, `text-ink`, `rounded-card`) rather than reaching
 * for raw hex values, so a palette change stays a one-file edit.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /** Role: active nav pill, user avatar, key accents */
        primary: {
          DEFAULT: "#1FA390",
          dark: "#0F6F62",
          tint: "#DDF3EE",
        },
        /** Very pale mint canvas behind every screen */
        canvas: "#F3F8F7",
        /** Cards, search bar, bottom nav */
        surface: "#FFFFFF",
        ink: {
          /** Titles, doctor names */
          DEFAULT: "#1B2B34",
          /** Specialty, availability, location label, inactive icons */
          muted: "#7C8A92",
        },
        /** Search bar outline, inactive chip outline */
        line: "#E3ECEA",
        accent: {
          teal: "#1FA390",
          blue: "#2D9CDB",
          purple: "#8B5CF6",
        },
        /** Non-token status colours (state only, never decoration) */
        danger: "#D64545",
        warning: "#C77700",
        success: "#1FA390",
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans Variable",
          "Plus Jakarta Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        // [size, { lineHeight }] — from the typography section of the style guide.
        screen: ["24px", { lineHeight: "30px", letterSpacing: "-0.02em" }], // Screen title
        context: ["12px", { lineHeight: "16px" }], // Context label ("Lagos · Good morning")
        card: ["15px", { lineHeight: "20px" }], // Card title (doctor name)
        sub: ["12px", { lineHeight: "16px" }], // Card subtitle
        meta: ["12px", { lineHeight: "16px" }], // Meta text (next slot, rating)
        chip: ["12px", { lineHeight: "16px" }], // Chip + nav labels
      },
      borderRadius: {
        card: "20px", // Cards
        nav: "28px", // Floating bottom nav
        pill: "9999px", // Search bar, chips, rating badge
      },
      boxShadow: {
        /** Cards — "no border" */
        card: "0 4px 16px rgba(20, 60, 55, 0.08)",
        /** Floating bottom nav — noticeably stronger than a card */
        nav: "0 12px 32px rgba(20, 60, 55, 0.16)",
        /** Bottom sheets / modals */
        sheet: "0 -8px 32px rgba(20, 60, 55, 0.14)",
        /** Raised state on press-free elements (sticky headers) */
        header: "0 4px 20px rgba(20, 60, 55, 0.06)",
      },
      spacing: {
        // 4px base unit; the guide uses 8 / 12 / 16 / 20 most often.
        gutter: "20px", // Screen side padding
        card: "14px", // Card inner padding (14–16px)
        section: "20px", // Gap between header, search, chips, list
      },
      strokeWidth: {
        icon: "1.5", // Outline iconography
      },
      transitionTimingFunction: {
        press: "cubic-bezier(0.2, 0.8, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both",
        "sheet-up": "sheet-up 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) both",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
