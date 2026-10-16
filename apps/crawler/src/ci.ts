import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClaudeClient, resolveAuth } from "./auth";
import { createPlaywrightLoader } from "./browser";
import { DEFAULT_MODEL } from "./config";
import { loadEnv } from "./env";
import { ClaudeExtractor } from "./extract/claude";
import { PoliteFetcher } from "./fetcher";
import { fileOutput, OUTPUT_ROOT } from "./output";
import { RobotsGate } from "./robots";
import { MissingClaudeCredentialsError, runCrawl, type RunSummary, type Trigger } from "./run";
import { LocalCache, SupabaseStore, type RequestedRun, type ScheduleStore } from "./store";
import type { CrawlSource } from "./types";

const HELP = `Usage: pnpm --filter crawler ci -- --mode <requested|monthly|both> [options]

  GitHub Actions entrypoint. Claims crawl_runs with status=requested and/or
  crawls active sources whose schedule is monthly. Claude auth is Workload
  Identity Federation via the job's GitHub OIDC token (no API key).

  --mode <name>     requested | monthly | both (required)
  --source <name>   also crawl this issuer once (workflow_dispatch)
  --limit <n>       only fetch the first n card pages per source
  -h, --help        show this help`;

export type CiMode = "requested" | "monthly" | "both";

export interface CrawlJob {
  source: string;
  runId?: string;
  trigger: Trigger;
  reason: "requested" | "monthly" | "dispatch";
}

export interface CiOptions {
  mode: CiMode;
  /** Extra issuer from workflow_dispatch. */
  source?: string;
  limit?: number;
}

/** Pure: turn DB rows + mode into an ordered, de-duplicated job list. */
export function planJobs(
  opts: CiOptions,
  requested: RequestedRun[],
  monthly: CrawlSource[],
): CrawlJob[] {
  const jobs: CrawlJob[] = [];
  const seen = new Set<string>();

  const add = (job: CrawlJob) => {
    const key = job.source.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push(job);
  };

  if (opts.mode === "requested" || opts.mode === "both") {
    for (const run of requested) {
      const trigger = (["manual", "cli", "schedule"] as const).includes(run.trigger as Trigger)
        ? (run.trigger as Trigger)
        : "manual";
      add({ source: run.source_scope, runId: run.id, trigger, reason: "requested" });
    }
  }

  if (opts.mode === "monthly" || opts.mode === "both") {
    for (const src of monthly) {
      add({ source: src.issuer_name, trigger: "schedule", reason: "monthly" });
    }
  }

  if (opts.source?.trim()) {
    add({ source: opts.source.trim(), trigger: "manual", reason: "dispatch" });
  }

  return jobs;
}

export interface CiDeps {
  store: ScheduleStore;
  crawl: (job: CrawlJob) => Promise<RunSummary>;
  log?: (msg: string) => void;
}

export interface CiResult {
  jobs: CrawlJob[];
  summaries: RunSummary[];
  /** Non-zero when any crawl failed or there was nothing to do is still 0. */
  exitCode: number;
}

export async function runCi(opts: CiOptions, deps: CiDeps): Promise<CiResult> {
  const log = deps.log ?? (() => {});
  const requested =
    opts.mode === "requested" || opts.mode === "both" ? await deps.store.listRequestedRuns() : [];
  const monthly =
    opts.mode === "monthly" || opts.mode === "both"
      ? await deps.store.listActiveSourcesBySchedule("monthly")
      : [];
  const jobs = planJobs(opts, requested, monthly);

  if (jobs.length === 0) {
    log("nothing to crawl (no requested runs, no monthly sources, no --source)");
    return { jobs, summaries: [], exitCode: 0 };
  }

  log(`planned ${jobs.length} crawl(s): ${jobs.map((j) => `${j.source} (${j.reason})`).join(", ")}`);
  const summaries: RunSummary[] = [];
  let failed = 0;
  for (const job of jobs) {
    log(`── ${job.reason}: ${job.source}${job.runId ? ` (run ${job.runId})` : ""}`);
    try {
      const summary = await deps.crawl(job);
      summaries.push(summary);
      if (summary.status !== "done") failed++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      log(`error: ${job.source} aborted — ${message}`);
      // A throw before createRun leaves a requested row stuck in the queue;
      // mark it failed so the next schedule does not retry the same poison pill.
      if (job.runId) {
        try {
          await deps.store.updateRun(job.runId, {
            status: "failed",
            error: message,
            finished_at: new Date().toISOString(),
          });
        } catch (markErr) {
          log(
            `warning: could not mark run ${job.runId} failed (${markErr instanceof Error ? markErr.message : markErr})`,
          );
        }
      }
    }
  }
  return { jobs, summaries, exitCode: failed > 0 ? 1 : 0 };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      source: { type: "string" },
      limit: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });
  if (values.help || !values.mode) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  if (!(["requested", "monthly", "both"] as const).includes(values.mode as CiMode)) {
    console.error("--mode must be requested, monthly, or both");
    return 1;
  }
  const limit = values.limit !== undefined ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    console.error("--limit must be a positive integer");
    return 1;
  }

  loadEnv();
  const log = (m: string) => console.log(m);
  const auth = resolveAuth(process.env);
  for (const w of auth.warnings) log(`warning: ${w}`);
  if (auth.status === "invalid") {
    console.error(`Error: ${auth.error}`);
    return 2;
  }
  if (auth.status === "none") {
    console.error(`Error: ${new MissingClaudeCredentialsError().message}`);
    return 2;
  }
  log(`Claude auth: workload identity federation via ${auth.config.source}`);

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (GitHub Actions secrets).");
    return 2;
  }

  const model = process.env.CRAWLER_MODEL?.trim() || DEFAULT_MODEL;
  const store = SupabaseStore.fromEnv(url, key);
  const loader = await createPlaywrightLoader(log);
  try {
    const fetcher = new PoliteFetcher(loader, new RobotsGate(), { log });
    const extractor = new ClaudeExtractor(createClaudeClient(auth.config), model);
    const cache = await new LocalCache(path.join(OUTPUT_ROOT, "cache.json")).load();

    const result = await runCi(
      { mode: values.mode as CiMode, source: values.source, limit },
      {
        store,
        log,
        crawl: (job) =>
          runCrawl(
            {
              source: job.source,
              dryRun: false,
              limit,
              trigger: job.trigger,
              runId: job.runId,
            },
            {
              store,
              fetcher,
              extractor,
              cache,
              output: (runId) => fileOutput(path.join(OUTPUT_ROOT, runId)),
              log,
            },
          ),
      },
    );

    for (const s of result.summaries) {
      log(
        `result ${s.source}: ${s.status}` +
          (s.error ? ` — ${s.error}` : "") +
          ` (findings new/changed/unchanged/discontinued: ` +
          `${s.counts.findings_new}/${s.counts.findings_changed}/${s.counts.findings_unchanged}/${s.counts.findings_possibly_discontinued})`,
      );
    }
    return result.exitCode;
  } finally {
    await loader.close();
  }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    },
  );
}
