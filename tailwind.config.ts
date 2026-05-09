import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        hebrew: [
          "var(--font-heebo)",
          "var(--font-assistant)",
          "Arial Hebrew",
          "SF Hebrew",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#1d3557",
        body: "#2a2a2a",
      },
    },
  },
  plugins: [],
};

export default config;
