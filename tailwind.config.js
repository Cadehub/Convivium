/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hotel: {
          bg: "var(--bg-page)",
          surface: "var(--bg-surface)",
          subtle: "var(--bg-subtle)",
          hover: "var(--bg-hover)",
          border: "var(--border-subtle)",
          borderStrong: "var(--border-default)",
          text: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          gold: "var(--brand-gold)",
          goldBright: "var(--brand-gold-bright)",
          goldSoft: "var(--brand-gold-soft)",
          goldBorder: "var(--brand-gold-border)",
          dark: "var(--brand-dark)",
          // Legacy aliases mapped to light tokens for safety
          black: "var(--bg-page)",
          card: "var(--bg-surface)",
          cardBorder: "var(--border-subtle)",
          goldLight: "var(--brand-gold-bright)",
          goldDark: "var(--brand-gold)",
          cream: "var(--bg-subtle)",
          success: "#059669",
          warning: "#D97706",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', '"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(24, 22, 20, 0.04)",
        card: "0 2px 8px -2px rgba(24, 22, 20, 0.06), 0 1px 3px -1px rgba(24, 22, 20, 0.04)",
        elevated: "0 12px 32px -8px rgba(24, 22, 20, 0.10), 0 4px 12px -2px rgba(24, 22, 20, 0.05)",
      },
    },
  },
  plugins: [],
};
