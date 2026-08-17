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
        jus: {
          petroleum: {
            DEFAULT: "#002B43",
            hover: "#003B5C",
            dark: "#001D2E",
            light: "#00476E",
            100: "#E6EFFA",
          },
          caramel: {
            DEFAULT: "#C08A4E",
            hover: "#A8743A",
            light: "#D4A36B",
            50: "#FAF3EB",
            100: "#F5E7D8",
          },
          darkgray: "#4A4A4A",
          canvas: "#F8FAFC",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Roboto", "Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
