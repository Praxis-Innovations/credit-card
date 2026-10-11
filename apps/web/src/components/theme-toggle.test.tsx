// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";

const html = document.documentElement;

function mockSystemTheme(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/** In-memory storage; Node 25's built-in localStorage global can shadow jsdom's. */
function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)();
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
  delete html.dataset.theme;
  mockSystemTheme(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("labels itself with the theme it switches to", () => {
    html.dataset.theme = "light";
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeTruthy();
  });

  it("switches data-theme and its label on each click", () => {
    html.dataset.theme = "light";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(html.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button"));
    expect(html.dataset.theme).toBe("light");
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeTruthy();
  });

  it("persists the explicit choice in localStorage", () => {
    html.dataset.theme = "light";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(screen.getByRole("button"));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("still switches when localStorage throws", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    html.dataset.theme = "light";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(html.dataset.theme).toBe("dark");
  });

  it("follows system changes until the user picks a theme", () => {
    let onChange: () => void = () => {};
    let systemDark = false;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return systemDark;
      },
      media: query,
      addEventListener: (_: string, cb: () => void) => {
        onChange = cb;
      },
      removeEventListener: vi.fn(),
    }));
    html.dataset.theme = "light";
    render(<ThemeToggle />);

    systemDark = true;
    act(() => onChange());
    expect(html.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button"));
    systemDark = true;
    act(() => onChange());
    expect(html.dataset.theme).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("uses the system preference when nothing is stored", () => {
    mockSystemTheme(true);
    runInitScript();
    expect(html.dataset.theme).toBe("dark");

    mockSystemTheme(false);
    runInitScript();
    expect(html.dataset.theme).toBe("light");
  });

  it("prefers a stored choice over the system preference", () => {
    mockSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript();
    expect(html.dataset.theme).toBe("light");
  });

  it("ignores invalid stored values", () => {
    mockSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    runInitScript();
    expect(html.dataset.theme).toBe("dark");
  });

  it("falls back to the system preference when localStorage throws", () => {
    mockSystemTheme(true);
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    runInitScript();
    expect(html.dataset.theme).toBe("dark");
  });
});
