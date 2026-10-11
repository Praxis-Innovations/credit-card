/**
 * Light/dark theme on <html data-theme>. With no stored choice the system
 * preference wins; an explicit choice from the toggle is kept in localStorage.
 * Storage access is wrapped because it throws when blocked (e.g. some private
 * modes or disabled cookies).
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "northtap-theme";

/** Fired on window whenever applyTheme changes the attribute. */
export const THEME_CHANGE_EVENT = "northtap-themechange";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not persisted; the choice still applies for this page view.
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

export function getAppliedTheme(): Theme | null {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : null;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Follow system changes until the user makes an explicit choice. */
export function watchSystemTheme(): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  if (!query) return () => {};
  const onChange = () => {
    if (getStoredTheme() === null) applyTheme(getSystemTheme());
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Inlined in <head> so data-theme is set before first paint (no flash). Kept
 * dependency-free because it runs before any bundle loads.
 */
export const THEME_INIT_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}if(t!=="light"&&t!=="dark"){try{t=window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light"}catch(e){t="light"}}document.documentElement.setAttribute("data-theme",t)})();`;
