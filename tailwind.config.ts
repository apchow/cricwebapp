import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#04120b",
          900: "#071c11",
          800: "#0b2a19",
          700: "#123c24",
          600: "#1a5232",
          500: "#22c55e",
        },
        turf: "#166534",
        saffron: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        turf:
          "repeating-linear-gradient(100deg, rgba(34,197,94,0.07) 0 24px, rgba(0,0,0,0) 24px 48px), radial-gradient(ellipse at 50% -20%, rgba(34,197,94,0.16), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
