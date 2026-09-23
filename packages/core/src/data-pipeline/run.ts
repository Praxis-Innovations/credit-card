import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "../cards";
import { MERCHANT_PARTNERSHIPS } from "../partnerships";
import { parseScope, sourcesForScope } from "./cadence";
import { corroborateConflicts } from "./corroborate";
import {
  loadReviewDecisions,
  rejectedFingerprints,
} from "./decisions";
import { diffStagingAgainstProduction } from "./diff";
import { extractCardFacts } from "./extract/cards";
import { htmlToText } from "./extract/html";
import { extractPartnershipFacts } from "./extract/partnerships";
import { extractExpiryFacts } from "./expiry";
import { fetchSource } from "./fetch";
import { formatDiffReportMarkdown } from "./report";
import { PIPELINE_VERSION } from "./sources";
import {
  loadRejectedFingerprintsRemote,
  tryCreateServiceClient,
} from "./supabase";
import type { CrawlScope, StagingFact, StagingSnapshot } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RunOptions {
  /** Override output root (defaults to this package's data-pipeline dir). */
  outDir?: string;
  /** Limit sources (tests / dry slices). */
  sourceIds?: string[];
  /** Risk-based crawl scope. */
  scope?: CrawlScope;
  fetchImpl?: typeof fetch;
  /** Skip live corroboration fetches (tests). */
  skipCorroboration?: boolean;
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
 * Never writes to cards.ts / partnerships.ts / Supabase without promote.
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
  const crawlScope = options.scope ?? parseScope(process.env.PIPELINE_SCOPE);

  const scopeSources = sourcesForScope(crawlScope);
  const sources = options.sourceIds
    ? scopeSources.filter((s) => options.sourceIds!.includes(s.id))
    : scopeSources;

  const facts: StagingFact[] = [];
  const attempts = [];

  for (const source of sources) {
    const { attempt, html } = await fetchSource(source, options.fetchImpl);
    attempts.push(attempt);
    if (!html || attempt.outcome !== "ok") continue;

    const text = htmlToText(html);
    facts.push(
      ...extractExpiryFacts({
        text,
        issuer: source.issuer,
        sourceUrl: source.url,
        capturedAt: attempt.capturedAt,
        brand: source.brand,
        subject: source.brand ?? source.id,
      }),
    );

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
    crawlScope,
    capturedAt,
    sources: attempts,
    facts,
  };

  const localDecisions = await loadReviewDecisions(
    path.join(outDir, "state", "review-decisions.json"),
  );
  const rejected = rejectedFingerprints(localDecisions);
  const client = tryCreateServiceClient();
  if (client) {
    try {
      for (const fp of await loadRejectedFingerprintsRemote(client)) {
        rejected.add(fp);
      }
    } catch (err) {
      console.warn(
        `Could not load remote rejected fingerprints: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  let report = diffStagingAgainstProduction({
    snapshot,
    cards: CARDS,
    partnerships: MERCHANT_PARTNERSHIPS,
    rejectedFingerprints: rejected,
  });

  if (!options.skipCorroboration) {
    report = {
      ...report,
      findings: await corroborateConflicts(
        report.findings,
        options.fetchImpl,
      ),
    };
  }

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
  const scope = parseScope(process.env.PIPELINE_SCOPE);
  console.log(
    `NorthTap data-pipeline ${PIPELINE_VERSION} — Big Six crawl (scope=${scope})`,
  );
  const result = await runPipeline({ scope });
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
