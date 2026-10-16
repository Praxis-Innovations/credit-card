import { defineConfig, devices } from "@playwright/test";
import { urls } from "./src/env";

const isCI = !!process.env.CI;

/**
 * Four Playwright projects — one per surface. The stack (local Supabase +
 * apps) must already be up; see README.md and scripts/stack-up.sh.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "test-results",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      use: {
        baseURL: urls.api,
        extraHTTPHeaders: {
          accept: "application/json",
        },
      },
    },
    {
      name: "web",
      testDir: "./tests/web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: urls.web,
      },
    },
    {
      name: "admin",
      testDir: "./tests/admin",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: urls.admin,
      },
    },
    {
      name: "app",
      testDir: "./tests/app",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: urls.app,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
