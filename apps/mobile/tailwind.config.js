/** @type {import('tailwindcss').Config} */
// Brand tokens mirror the design source (Vilo Mobile App.html) and the web
// app's Tailwind config so classes translate ~1:1 between web and mobile.
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
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
          line: "#E4EFE8",
        },
        status: {
          confirmed: "#10B981",
          pending: "#F59E0B",
          cancelled: "#EF4444",
        },
      },
      // RN custom fonts are one family per weight, so we expose weight-specific
      // utilities (font-sans-semibold, font-display-extrabold, …) instead of
      // relying on font-weight classes, which can't switch the glyph family.
      fontFamily: {
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        display: ["PlusJakartaSans_700Bold"],
        "display-semibold": ["PlusJakartaSans_600SemiBold"],
        "display-extrabold": ["PlusJakartaSans_800ExtraBold"],
        mono: ["JetBrainsMono_500Medium"],
      },
      borderRadius: {
        DEFAULT: "10px",
        card: "16px",
        pill: "9999px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};
