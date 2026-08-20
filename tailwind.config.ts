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
            hover: "#003A58",
            active: "#001F31",
            dark: "#001F31",
            light: "#00476E",
            100: "#E6EFFA",
            50: "#F0F5FA",
          },
          caramel: {
            DEFAULT: "#C08A4E",
            hover: "#A8743A",
            active: "#91622F",
            light: "#D4A36B",
            soft: "#E7D6C4",
            50: "#FAF3EB",
            100: "#F5E7D8",
          },
          darkgray: "#4A4A4A",
          canvas: "#F1F1F1",
          surface: "#FFFFFF",
          "surface-muted": "#ECECEC",
          text: "#202020",
          "text-muted": "#6E7580",
          border: "#D7D7D7",
          success: {
            DEFAULT: "#2E7D32",
            soft: "#E5F4E7",
          },
          danger: {
            DEFAULT: "#B3261E",
            soft: "#FBE9E7",
          },
          info: "#126B9C",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Roboto", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 10px rgba(0, 0, 0, 0.08)",
        "card-lg": "0 6px 18px rgba(0, 0, 0, 0.12)",
        "card-elevated": "0 10px 25px -3px rgba(0, 43, 67, 0.12)",
      },
      borderRadius: {
        card: "18px",
        btn: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
