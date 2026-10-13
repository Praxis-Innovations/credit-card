import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createPlaywrightLoader } from "./browser";
import { DEFAULT_MODEL } from "./config";
import { ClaudeExtractor } from "./extract/claude";
import { PoliteFetcher } from "./fetcher";
import { fileOutput, OUTPUT_ROOT } from "./output";
import { RobotsGate } from "./robots";
import { MissingApiKeyError, runCrawl, type RunSummary } from "./run";
import { LocalCache, OfflineStore, ReadOnlyStore, SupabaseStore, type Store } from "./store";

const HELP = `Usage: pnpm --filter crawler crawl --source <issuer> [options]

  --source <name>   crawl_sources.issuer_name, e.g. scotiabank (required)
  --dry-run         read from the database if configured, write nothing to it
  --limit <n>       only fetch the first n card pages
  --model <id>      Claude model (default $CRAWLER_MODEL or ${DEFAULT_MODEL})
  --no-llm          no Claude: fetch the compare page, pick card links
                    heuristically and save cleaned page text only
  -h, --help        show this help

Output goes to apps/crawler/output/<run-id>/ (gitignored).`;

function loadEnv() {
  const root = path.resolve(OUTPUT_ROOT, "..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

async function chooseStore(dryRun: boolean, log: (m: string) => void): Promise<Store> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (!dryRun) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/crawler/.env.local (or pass --dry-run).",
      );
    }
    log("no Supabase credentials: offline dry run (built-in source list, no catalog diff)");
    return new OfflineStore();
  }
  const db = SupabaseStore.fromEnv(url, key);
  if (!dryRun) return db;
  return new ReadOnlyStore(db, log);
}

function printSummary(s: RunSummary) {
  const c = s.counts;
  const lines = [
    "",
    `Run ${s.run_id} — ${s.source} — ${s.status.toUpperCase()} (${s.mode}${s.no_llm ? ", no LLM" : `, ${s.model}`})`,
    s.error ? `Error: ${s.error}` : null,
    `Compare page: ${s.compare_url}`,
    `  same-site links on page: ${c.links_on_compare_page}`,
    `  card pages discovered:   ${c.cards_discovered}`,
    `Pages fetched: ${c.pages_fetched}, skipped: ${c.pages_skipped}`,
    s.no_llm
      ? null
      : `Claude calls: ${c.claude_calls}, hash skips: ${c.hash_skips}, cards extracted: ${c.cards_extracted}, flagged values: ${c.flagged_values}`,
    s.no_llm
      ? null
      : `Diff vs catalog: new ${c.findings_new}, changed ${c.findings_changed}, unchanged ${c.findings_unchanged}, possibly discontinued ${c.findings_possibly_discontinued}`,
    s.no_llm
      ? null
      : `Tokens: ${s.usage.inputTokens} in / ${s.usage.outputTokens} out — est. $${s.cost_estimate_usd.toFixed(4)}` +
        (s.cost_per_extracted_card_usd !== null ? ` ($${s.cost_per_extracted_card_usd.toFixed(4)} per extracted card)` : ""),
    "",
    "Card pages:",
    ...s.discovered.map((d, i) => `  ${String(i + 1).padStart(2)}. ${d.card_name} — ${d.url}`),
    ...(s.skipped.length ? ["", "Skipped:", ...s.skipped.map((k) => `  ${k.reason}: ${k.url} (${k.detail})`)] : []),
    ...(s.findings.length
      ? [
          "",
          "Findings:",
          ...s.findings.map(
            (f) =>
              `  ${(f.diff_kind ?? "extracted").padEnd(21)} ${f.card_name}${f.linked_card_id ? ` [${f.linked_card_id}]` : ""}` +
              `${f.flagged ? ` — ${f.flagged} flagged` : ""}${f.reused ? " (unchanged page)" : ""}` +
              (f.changes.length ? `\n${f.changes.map((ch) => `      ${ch.field}: ${ch.catalog} -> ${ch.extracted}${ch.flagged ? " (flagged)" : ""}`).join("\n")}` : ""),
          ),
        ]
      : []),
    "",
    s.output_dir ? `Saved to ${s.output_dir}` : null,
  ];
  console.log(lines.filter((l) => l !== null).join("\n"));
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      model: { type: "string" },
      "no-llm": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });
  if (values.help || !values.source) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  const limit = values.limit !== undefined ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    console.error("--limit must be a positive integer");
    return 1;
  }

  loadEnv();
  const log = (m: string) => console.log(m);
  const dryRun = values["dry-run"];
  const noLlm = values["no-llm"];
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!noLlm && !apiKey) {
    console.error(`Error: ${new MissingApiKeyError().message}`);
    return 2;
  }
  const model = values.model ?? process.env.CRAWLER_MODEL?.trim() ?? DEFAULT_MODEL;

  const store = await chooseStore(dryRun, log);
  const loader = await createPlaywrightLoader(log);
  try {
    const summary = await runCrawl(
      { source: values.source, dryRun, noLlm, limit, trigger: "cli" },
      {
        store,
        fetcher: new PoliteFetcher(loader, new RobotsGate(), { log }),
        extractor: noLlm ? null : ClaudeExtractor.fromApiKey(apiKey!, model),
        cache: await new LocalCache(path.join(OUTPUT_ROOT, "cache.json")).load(),
        output: (runId) => fileOutput(path.join(OUTPUT_ROOT, runId)),
        log,
      },
    );
    printSummary(summary);
    return summary.status === "done" ? 0 : 1;
  } finally {
    await loader.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  },
);
