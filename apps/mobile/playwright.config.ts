import { defineConfig, devices } from "@playwright/test";

const PORT = 8081;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Serves the Expo static web export so E2E exercises the same artifact the
 * marketing CTA will eventually point at (not just the Metro dev server).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm exec expo export --platform web && pnpm exec serve dist -l ${PORT} --no-port-switching`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2UyfQ.e2e-test-anon-key",
      EXPO_PUBLIC_NORTHTAP_API_URL: "http://127.0.0.1:8787",
      EXPO_PUBLIC_NORTHTAP_API_KEY:
        "nt_live_northtap_expo_internal_v1_7f3a9c2e8b1d4f06",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
