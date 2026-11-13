import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: "#F47FA5",
          pinkDark: "#D65A84",
          lightPink: "#FFE4EC",
          cream: "#FFF8F3",
          yellow: "#F7EFE2",
          lavender: "#F7EFF4",
          ink: "#261B20",
          muted: "#6E5E65",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto-thai)", "var(--font-quicksand)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(24, 20, 22, 0.05), 0 8px 24px -12px rgba(24, 20, 22, 0.08)",
        card: "0 1px 2px rgba(24, 20, 22, 0.04)",
      },
      borderRadius: {
        "2xl": "0.875rem",
        "3xl": "1.125rem",
      },
    },
  },
  plugins: [],
};

export default config;
