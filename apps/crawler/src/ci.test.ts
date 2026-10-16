import { describe, expect, it, vi } from "vitest";
import { planJobs, runCi, type CiDeps } from "./ci";
import type { RunSummary } from "./run";
import type { RequestedRun, ScheduleStore } from "./store";
import type { CrawlSource } from "./types";

const scotia: CrawlSource = {
  id: "src-scotia",
  issuer_name: "Scotiabank",
  compare_url: "https://example.com/compare",
  url_pattern: "/credit-cards/",
  status: "active",
};

const rbc: CrawlSource = {
  id: "src-rbc",
  issuer_name: "RBC",
  compare_url: "https://example.com/rbc",
  url_pattern: null,
  status: "active",
};

const requested: RequestedRun[] = [
  { id: "run-1", source_id: "src-scotia", source_scope: "Scotiabank", trigger: "manual" },
  { id: "run-2", source_id: "src-rbc", source_scope: "RBC", trigger: "manual" },
];

function summary(source: string, status: "done" | "failed" = "done"): RunSummary {
  return {
    run_id: "x",
    source,
    compare_url: "",
    mode: "database",
    model: null,
    no_llm: false,
    limit: null,
    started_at: "",
    finished_at: "",
    status,
    error: status === "failed" ? "boom" : null,
    counts: {
      links_on_compare_page: 0,
      cards_discovered: 0,
      pages_fetched: 0,
      pages_skipped: 0,
      claude_calls: 0,
      hash_skips: 0,
      cards_extracted: 0,
      flagged_values: 0,
      findings_new: 0,
      findings_changed: 0,
      findings_unchanged: 0,
      findings_possibly_discontinued: 0,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    cost_estimate_usd: 0,
    cost_per_extracted_card_usd: null,
    discovered: [],
    skipped: [],
    findings: [],
    output_dir: null,
  };
}

describe("planJobs", () => {
  it("picks up requested runs oldest-first order preserved", () => {
    expect(planJobs({ mode: "requested" }, requested, [scotia, rbc])).toEqual([
      { source: "Scotiabank", runId: "run-1", trigger: "manual", reason: "requested" },
      { source: "RBC", runId: "run-2", trigger: "manual", reason: "requested" },
    ]);
  });

  it("plans monthly sources with schedule trigger", () => {
    expect(planJobs({ mode: "monthly" }, requested, [scotia, rbc])).toEqual([
      { source: "Scotiabank", trigger: "schedule", reason: "monthly" },
      { source: "RBC", trigger: "schedule", reason: "monthly" },
    ]);
  });

  it("both: requested first, then monthly without duplicating an issuer", () => {
    expect(planJobs({ mode: "both" }, requested, [scotia, rbc])).toEqual([
      { source: "Scotiabank", runId: "run-1", trigger: "manual", reason: "requested" },
      { source: "RBC", runId: "run-2", trigger: "manual", reason: "requested" },
    ]);
    expect(
      planJobs({ mode: "both" }, [requested[0]!], [scotia, rbc]),
    ).toEqual([
      { source: "Scotiabank", runId: "run-1", trigger: "manual", reason: "requested" },
      { source: "RBC", trigger: "schedule", reason: "monthly" },
    ]);
  });

  it("adds a dispatch source when it is not already planned", () => {
    expect(planJobs({ mode: "requested", source: "TD" }, requested, [])).toEqual([
      { source: "Scotiabank", runId: "run-1", trigger: "manual", reason: "requested" },
      { source: "RBC", runId: "run-2", trigger: "manual", reason: "requested" },
      { source: "TD", trigger: "manual", reason: "dispatch" },
    ]);
  });

  it("does not duplicate a dispatch source already in requested", () => {
    expect(planJobs({ mode: "requested", source: "scotiabank" }, requested, [])).toHaveLength(2);
  });

  it("treats unknown triggers on requested rows as manual", () => {
    const odd: RequestedRun[] = [{ id: "r", source_id: null, source_scope: "X", trigger: "webhook" }];
    expect(planJobs({ mode: "requested" }, odd, [])[0]).toMatchObject({ trigger: "manual" });
  });
});

describe("runCi", () => {
  function deps(over: Partial<CiDeps> = {}): CiDeps {
    const store = {
      mode: "database" as const,
      listRequestedRuns: vi.fn(async () => requested),
      listActiveSourcesBySchedule: vi.fn(async () => [scotia, rbc]),
      ...(over.store ?? {}),
    } as unknown as ScheduleStore;
    return {
      store,
      crawl: over.crawl ?? vi.fn(async (job) => summary(job.source)),
      log: over.log ?? (() => {}),
    };
  }

  it("exits 0 when there is nothing to do", async () => {
    const d = deps({
      store: {
        listRequestedRuns: vi.fn(async () => []),
        listActiveSourcesBySchedule: vi.fn(async () => []),
      } as unknown as ScheduleStore,
    });
    const result = await runCi({ mode: "both" }, d);
    expect(result).toMatchObject({ jobs: [], summaries: [], exitCode: 0 });
    expect(d.crawl).not.toHaveBeenCalled();
  });

  it("runs each planned job and fails the batch if any crawl failed", async () => {
    const crawl = vi.fn(async (job: { source: string }) =>
      summary(job.source, job.source === "RBC" ? "failed" : "done"),
    );
    const result = await runCi({ mode: "requested" }, deps({ crawl }));
    expect(crawl).toHaveBeenCalledTimes(2);
    expect(crawl).toHaveBeenNthCalledWith(1, expect.objectContaining({ runId: "run-1" }));
    expect(result.exitCode).toBe(1);
  });

  it("skips listing monthly sources in requested-only mode", async () => {
    const d = deps();
    await runCi({ mode: "requested" }, d);
    expect(d.store.listActiveSourcesBySchedule).not.toHaveBeenCalled();
    expect(d.store.listRequestedRuns).toHaveBeenCalled();
  });
});
