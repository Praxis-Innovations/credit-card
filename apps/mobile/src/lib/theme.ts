/** NorthTap palette — shared visual language with the marketing site greens. */
export const colors = {
  bg: "#F4F7F5",
  card: "#FFFFFF",
  border: "#D5E0DA",
  primary: "#0B3D2E",
  primaryFg: "#F4F7F5",
  accent: "#C4F04D",
  foreground: "#10231C",
  muted: "#3D5A4E",
  mutedBg: "#E8F0EB",
  danger: "#9B1C1C",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
} as const;

/** Approved logo colours; keep in sync with assets/brand/*.svg. */
export const brand = {
  teal: "#0c5c56",
  paleTeal: "#bfe0da",
  /** Shaded needle half on the reverse (white-card) mark. */
  needleShade: "#5e9a93",
  ink: "#141816",
  white: "#ffffff",
} as const;

/** Key registered with expo-font in app/_layout.tsx. */
export const WORDMARK_FONT = "Syne_600SemiBold";
