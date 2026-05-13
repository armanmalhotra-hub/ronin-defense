import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        paper: "#f3f4f6",
        forest: "#15803d",
        leaf: "#22c55e",
        moss: "#86efac",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
