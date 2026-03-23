import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: "1rem"
      },
      fontFamily: {
        display: ['"League Gothic"', '"Arial Narrow"', "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          DEFAULT: "#0ea5e9",
          dark: "#0284c7",
          light: "#38bdf8"
        }
      }
    }
  }
};

export default config;
