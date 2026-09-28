import { Platform } from "react-native";
import { colors } from "./theme";

const STYLE_ID = "northtap-web-interaction";

const INTERACTIVE = '[role="button"],[role="tab"],[role="checkbox"],[role="link"],a[href]';

const CSS = `
${INTERACTIVE.split(",")
  .map((s) => `${s}:focus-visible`)
  .join(",")} {
  outline: 2px solid ${colors.primary};
  outline-offset: 2px;
}
${INTERACTIVE} { cursor: pointer; }
a[href]:hover, [role="link"]:hover { color: ${colors.primaryPressed}; }
[aria-disabled="true"] { cursor: default; }
input:focus-visible { outline: none; }
`;

/** Keyboard focus rings and pointer cursors that RN styles can't express. */
export function installWebInteractionStyles(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
