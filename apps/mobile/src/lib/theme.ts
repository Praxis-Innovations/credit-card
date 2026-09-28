/** NorthTap app palette + type scale, from the approved first-run design. */
export const colors = {
  bg: "#fbfbfa",
  card: "#ffffff",
  primary: "#0c5c56",
  primaryPressed: "#08403c",
  primaryFg: "#ffffff",
  mint: "#bfe0da",
  text: "#141816",
  textBody: "#4a524e",
  textMuted: "#5c6661",
  border: "#e3e8e5",
  borderInput: "#c7cfcb",
  borderStrong: "#d4dfda",
  borderDashed: "#b8c4be",
  divider: "#eef1ef",
  segmentBg: "#eef1ef",
  tint: "#eef3f1",
  tintStrong: "#e3ebe7",
  chip: "#d7c89b",
  warnBg: "#fff8eb",
  warnBorder: "#f0dcb4",
  warnIcon: "#7a4b00",
  warnText: "#3d2a05",
  danger: "#9b1c1c",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  scrim: "rgba(20,24,22,0.45)",
  googleText: "#1f1f1f",
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

/** Font family names registered in app/_layout.tsx via expo-font. */
export const fonts = {
  heading: WORDMARK_FONT,
  body: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
} as const;

/** Minimum touch target (px) for anything tappable. */
export const TOUCH = 44;

/** Native: width at which the Save sheet becomes a centered dialog (web uses responsive.ts). */
export const WIDE_BREAKPOINT = 768;

/** Native content column cap (web columns are set in responsive.ts). */
export const PHONE_COLUMN = 480;
