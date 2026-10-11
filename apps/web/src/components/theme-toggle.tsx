"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  THEME_CHANGE_EVENT,
  applyTheme,
  getAppliedTheme,
  storeTheme,
  watchSystemTheme,
} from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/**
 * The server can't know the theme, so the server snapshot is null and the
 * label settles on the client after hydration. The icon is picked by CSS from
 * data-theme, so it is right from first paint.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getAppliedTheme, () => null);

  useEffect(() => watchSystemTheme(), []);

  const label =
    theme === null
      ? "Switch colour theme"
      : theme === "dark"
        ? "Switch to light theme"
        : "Switch to dark theme";

  function toggle() {
    const next = getAppliedTheme() === "dark" ? "light" : "dark";
    storeTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-divider text-foreground transition-colors hover:bg-surface-divider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="dark:hidden"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
        className="hidden dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
    </button>
  );
}
