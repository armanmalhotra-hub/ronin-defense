import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#e9d8a6",
        dusk: "#0b132b",
        sunset: "#ee6c4d",
        cactus: "#3a5a40",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
