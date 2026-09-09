import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        phosphor: {
          DEFAULT: "#39ff6a",
          dim: "#1f8f42",
          amber: "#ffb020",
          red: "#ff5d5d",
          blue: "#2775CA",
        },
        term: {
          bg: "#050705",
          panel: "#0a0d0a",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        blink: { "0%, 49%": { opacity: "1" }, "50%, 100%": { opacity: "0" } },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.94" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.97" },
        },
        scan: { "0%": { backgroundPosition: "0 0" }, "100%": { backgroundPosition: "0 8px" } },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        flicker: "flicker 6s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
