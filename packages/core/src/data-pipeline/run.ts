import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "../cards";
import { MERCHANT_PARTNERSHIPS } from "../partnerships";
import { diffStagingAgainstProduction } from "./diff";
import { extractCardFacts } from "./extract/cards";
import { extractPartnershipFacts } from "./extract/partnerships";
import { fetchSource } from "./fetch";
import { formatDiffReportMarkdown } from "./report";
import { BIG_SIX_SOURCES, PIPELINE_VERSION } from "./sources";
import type { StagingFact, StagingSnapshot } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RunOptions {
  /** Override output root (defaults to this package's data-pipeline dir). */
  outDir?: string;
  /** Limit sources (tests / dry slices). */
  sourceIds?: string[];
  fetchImpl?: typeof fetch;
}

export interface PipelineRunResult {
  snapshot: StagingSnapshot;
  reportMarkdown: string;
  stagingPath: string;
  reportPath: string;
}

function runIdFrom(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

/**
 * Crawl configured Big Six sources → staging JSON + Markdown diff report.
 * Never writes to cards.ts / partnerships.ts.
 */
export async function runPipeline(
  options: RunOptions = {},
): Promise<PipelineRunResult> {
  const started = new Date();
  const runId = runIdFrom(started);
  const capturedAt = started.toISOString();
  const outDir = options.outDir ?? __dirname;
  const stagingDir = path.join(outDir, "staging");
  const reportsDir = path.join(outDir, "reports");

  const sources = options.sourceIds
    ? BIG_SIX_SOURCES.filter((s) => options.sourceIds!.includes(s.id))
    : BIG_SIX_SOURCES;

  const facts: StagingFact[] = [];
  const attempts = [];

  for (const source of sources) {
    const { attempt, html } = await fetchSource(source, options.fetchImpl);
    attempts.push(attempt);
    if (!html || attempt.outcome !== "ok") continue;

    if (source.kind === "card_listing") {
      facts.push(
        ...extractCardFacts({
          source,
          html,
          capturedAt: attempt.capturedAt,
          catalogCards: CARDS,
        }),
      );
    } else {
      facts.push(
        ...extractPartnershipFacts({
          source,
          html,
          capturedAt: attempt.capturedAt,
          partnerships: MERCHANT_PARTNERSHIPS,
        }),
      );
      // Partnership pages often also list card product names — capture lightly
      facts.push(
        ...extractCardFacts({
          source,
          html,
          capturedAt: attempt.capturedAt,
          catalogCards: CARDS,
        }),
      );
    }
  }

  const snapshot: StagingSnapshot = {
    pipelineVersion: PIPELINE_VERSION,
    runId,
    scope: "big-six",
    capturedAt,
    sources: attempts,
    facts,
  };

  const report = diffStagingAgainstProduction({
    snapshot,
    cards: CARDS,
    partnerships: MERCHANT_PARTNERSHIPS,
  });
  const reportMarkdown = formatDiffReportMarkdown(report, snapshot);

  await mkdir(stagingDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });

  const stagingPath = path.join(stagingDir, "latest.json");
  const stagingRunPath = path.join(stagingDir, `${runId}.json`);
  const reportPath = path.join(reportsDir, "latest.md");
  const reportRunPath = path.join(reportsDir, `${runId}.md`);
  const reportJsonPath = path.join(reportsDir, "latest.json");

  const stagingJson = `${JSON.stringify(snapshot, null, 2)}\n`;
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;

  await writeFile(stagingPath, stagingJson, "utf8");
  await writeFile(stagingRunPath, stagingJson, "utf8");
  await writeFile(reportPath, reportMarkdown, "utf8");
  await writeFile(reportRunPath, reportMarkdown, "utf8");
  await writeFile(reportJsonPath, reportJson, "utf8");

  return { snapshot, reportMarkdown, stagingPath, reportPath };
}

async function main(): Promise<void> {
  console.log(`NorthTap data-pipeline ${PIPELINE_VERSION} — Big Six crawl`);
  console.log(`Sources: ${BIG_SIX_SOURCES.length} (robots + rate-limited)`);
  const result = await runPipeline();
  const ok = result.snapshot.sources.filter((s) => s.outcome === "ok").length;
  const fail = result.snapshot.sources.length - ok;
  console.log(
    `Done. facts=${result.snapshot.facts.length} sources_ok=${ok} sources_fail=${fail}`,
  );
  console.log(`Staging: ${result.stagingPath}`);
  console.log(`Report:  ${result.reportPath}`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
