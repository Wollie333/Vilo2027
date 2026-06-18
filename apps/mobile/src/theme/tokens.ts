// Raw brand tokens for use where a className can't reach (icon colors, status
// bar style, native props). Mirrors tailwind.config.js and the design source.
export const brand = {
  primary: "#10B981",
  secondary: "#064E3B",
  deep: "#064E3B",
  accent: "#D1FAE5",
  dark: "#0A1510",
  light: "#F0FDF4",
  ink: "#052E1F",
  mute: "#4A7C6A",
  line: "#E4EFE8",
  white: "#FFFFFF",
} as const;

export const status = {
  confirmed: "#10B981",
  pending: "#F59E0B",
  cancelled: "#EF4444",
} as const;

// Booking-status → tag tone, matching the design's .tag colour families.
export type Tone = "green" | "amber" | "red" | "indigo" | "sky" | "gray";

export const fonts = {
  sans: "Inter",
  display: "PlusJakartaSans",
  mono: "JetBrainsMono",
} as const;
