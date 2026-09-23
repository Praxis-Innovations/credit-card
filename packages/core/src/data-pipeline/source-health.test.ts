import { describe, expect, it } from "vitest";
import { runSourceHealth } from "./source-health";

describe("runSourceHealth", () => {
  it("marks claim_missing when page lacks verified claims", async () => {
    const report = await runSourceHealth({
      useSupabase: false,
      limit: 1,
      fetchImpl: async () =>
        new Response("<html><body>Unrelated marketing copy</body></html>", {
          status: 200,
        }),
    });

    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]?.outcome).toBe("claim_missing");
    expect(report.summary.failed).toBe(1);
  });

  it("passes when claim tokens are present", async () => {
    const report = await runSourceHealth({
      useSupabase: false,
      limit: 1,
      fetchImpl: async () => {
        // First static row is Shell brand — include its name
        return new Response("<html><body>Welcome to Shell Canada</body></html>", {
          status: 200,
        });
      },
    });

    expect(report.checks[0]?.outcome).toBe("ok");
    expect(report.summary.ok).toBe(1);
  });

  it("flags http errors as unreachable/health failure", async () => {
    const report = await runSourceHealth({
      useSupabase: false,
      limit: 1,
      fetchImpl: async () => new Response("gone", { status: 404 }),
    });
    expect(report.checks[0]?.outcome).toBe("http_error");
  });
});
