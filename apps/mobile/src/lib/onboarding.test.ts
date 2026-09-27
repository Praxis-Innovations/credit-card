import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("./ssr-safe-storage", () => ({
  ssrSafeStorage: {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
}));

import {
  clearOnboardingComplete,
  loadOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_COMPLETE_KEY,
} from "./onboarding";
describe("onboarding storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("defaults to incomplete", async () => {
    await expect(loadOnboardingComplete()).resolves.toBe(false);
  });

  it("persists completion flag", async () => {
    await markOnboardingComplete();
    expect(store.get(ONBOARDING_COMPLETE_KEY)).toBe("1");
    await expect(loadOnboardingComplete()).resolves.toBe(true);
  });

  it("clears completion flag", async () => {
    await markOnboardingComplete();
    await clearOnboardingComplete();
    await expect(loadOnboardingComplete()).resolves.toBe(false);
  });
});
