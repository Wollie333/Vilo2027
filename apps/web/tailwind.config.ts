import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        brand: {
          primary: "#10B981",
          secondary: "#064E3B",
          deep: "#064E3B",
          accent: "#D1FAE5",
          dark: "#0A1510",
          light: "#F0FDF4",
          ink: "#052E1F",
          mute: "#4A7C6A",
          line: "#DCEAE0",
        },
        status: {
          confirmed: "#10B981",
          pending: "#F59E0B",
          cancelled: "#EF4444",
          completed: "#6366F1",
          draft: "#94A3B8",
          inhouse: "#0EA5E9",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        DEFAULT: "10px",
        card: "16px",
        pill: "9999px",
        sm: "6px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(6,78,59,0.04), 0 1px 1px rgba(6,78,59,0.03)",
        lift: "0 8px 28px -10px rgba(6,78,59,0.14), 0 2px 6px rgba(6,78,59,0.05)",
        ring: "0 0 0 4px rgba(16,185,129,0.15)",
        glow: "0 12px 32px -10px rgba(16,185,129,0.35)",
        peek: "0 24px 60px -20px rgba(6,78,59,0.25), 0 4px 12px rgba(6,78,59,0.06)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #10B981 0%, #064E3B 100%)",
        "brand-gradient-dark":
          "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
        "dot-grid":
          "radial-gradient(rgba(16,185,129,0.14) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "18px 18px",
      },
      ringColor: {
        DEFAULT: "#10B981",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
