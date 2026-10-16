import { describe, expect, it } from "vitest";
import { panelPill, panelState, panelTitle, whenLabel } from "./present";
import type { CrawlRun } from "./types";

const base: CrawlRun = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  source_id: "3f0e6f1c-2d4b-4c1a-9e8f-0a1b2c3d4e5f",
  source_scope: "Scotiabank",
  trigger: "manual",
  status: "requested",
  requested_by: "admin@example.com",
  created_at: "2026-10-15T12:00:00Z",
  started_at: null,
  finished_at: null,
  error: null,
};

describe("crawl panel presenters", () => {
  it("maps null to last_run", () => {
    expect(panelState(null)).toBe("last_run");
    expect(panelTitle("last_run")).toBe("Last run");
    expect(panelPill("last_run").tone).toBe("neutral");
    expect(whenLabel(null)).toBeNull();
  });

  it.each([
    ["requested", "Requested", "warn"],
    ["running", "Running", "ok"],
    ["done", "Done", "ok"],
    ["failed", "Failed", "bad"],
  ] as const)("%s → %s", (status, title, tone) => {
    const run = { ...base, status };
    expect(panelState(run)).toBe(status);
    expect(panelTitle(status)).toBe(title);
    expect(panelPill(status).tone).toBe(tone);
  });

  it("picks the right timestamp per status", () => {
    expect(whenLabel({ ...base, status: "requested" })).toBe(base.created_at);
    expect(
      whenLabel({ ...base, status: "running", started_at: "2026-10-15T12:05:00Z" }),
    ).toBe("2026-10-15T12:05:00Z");
    expect(
      whenLabel({
        ...base,
        status: "done",
        started_at: "2026-10-15T12:05:00Z",
        finished_at: "2026-10-15T12:20:00Z",
      }),
    ).toBe("2026-10-15T12:20:00Z");
  });
});
