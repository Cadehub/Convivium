/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hotel: {
          black: "#0a0a0a",
          surface: "#121212",
          card: "#181818",
          cardBorder: "#272727",
          muted: "#888888",
          subtle: "#a0a0a0",
          text: "#f5f5f5",
          gold: {
            DEFAULT: "#D4AF37",
            light: "#EACD6D",
            dark: "#A38222",
            subtle: "rgba(212, 175, 55, 0.12)",
            border: "rgba(212, 175, 55, 0.35)",
          },
          ivory: "#FBF9F5",
          accent: "#2A2A2A",
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(212, 175, 55, 0.25)',
        'card-dark': '0 4px 20px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
