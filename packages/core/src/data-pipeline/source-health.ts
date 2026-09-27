import {
  LOYALTY_PROGRAMS,
  MERCHANT_BRANDS,
  MERCHANT_PARTNERSHIPS,
} from "../partnerships";
import { htmlToText, textContainsClaim } from "./extract/html";
import { FETCH_TIMEOUT_MS, PER_HOST_DELAY_MS, USER_AGENT } from "./sources";
import type { CatalogSourceRow } from "./supabase";
import {
  loadVerifiedSourceRows,
  markCatalogStatus,
  tryCreateServiceClient,
} from "./supabase";
import type { CatalogTable } from "./types";

export type HealthOutcome =
  | "ok"
  | "unreachable"
  | "http_error"
  | "claim_missing"
  | "empty_body";

export interface SourceHealthCheck {
  table: CatalogTable | "static";
  id: string;
  sourceUrl: string;
  outcome: HealthOutcome;
  httpStatus?: number;
  detail?: string;
  checkedAt: string;
  /** When true, a verified Supabase row was flipped to stale. */
  markedStale?: boolean;
}

export interface SourceHealthReport {
  generatedAt: string;
  runId: string;
  checks: SourceHealthCheck[];
  summary: {
    ok: number;
    failed: number;
    markedStale: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fallback when Supabase is unavailable — use git-tracked partnership sources. */
export function staticVerifiedSourceRows(): CatalogSourceRow[] {
  const rows: CatalogSourceRow[] = [];
  for (const b of MERCHANT_BRANDS) {
    rows.push({
      table: "merchant_brands",
      id: b.id,
      sourceUrl: b.sourceUrl,
      claims: [b.name],
      status: "verified",
    });
  }
  for (const p of LOYALTY_PROGRAMS) {
    rows.push({
      table: "loyalty_programs",
      id: p.id,
      sourceUrl: p.sourceUrl,
      claims: [p.name],
      status: "verified",
    });
  }
  for (const p of MERCHANT_PARTNERSHIPS) {
    const claims = [
      ...p.benefits.map((b) => String(b.amount)),
      ...p.benefits.map((b) => b.summary),
      p.notes ?? "",
    ].filter(Boolean);
    for (const url of p.sourceUrls) {
      rows.push({
        table: "merchant_partnerships",
        id: p.id,
        sourceUrl: url,
        claims,
        status: "verified",
      });
    }
  }
  return rows;
}

/**
 * Light daily check: GET each verified sourceUrl, confirm reachability +
 * fuzzy claim presence. On failure, flip Supabase row to status=stale.
 */
export async function runSourceHealth(options?: {
  fetchImpl?: typeof fetch;
  reviewedBy?: string;
  /** Cap checks for tests. */
  limit?: number;
  useSupabase?: boolean;
}): Promise<SourceHealthReport> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const reviewedBy = options?.reviewedBy ?? "pipeline:source-health";
  const checkedAt = new Date().toISOString();
  const runId = checkedAt.replace(/[:.]/g, "-");

  const client =
    options?.useSupabase === false ? null : tryCreateServiceClient();
  let rows: CatalogSourceRow[] = staticVerifiedSourceRows();
  if (client) {
    try {
      rows = await loadVerifiedSourceRows(client);
    } catch (err) {
      console.warn(
        `Supabase verified-row load failed; using static sources: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // De-dupe by URL+id
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = `${r.table}|${r.id}|${r.sourceUrl}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const limited =
    options?.limit !== undefined ? unique.slice(0, options.limit) : unique;

  const checks: SourceHealthCheck[] = [];
  const lastHost = new Map<string, number>();

  for (const row of limited) {
    const host = new URL(row.sourceUrl).host;
    const wait = PER_HOST_DELAY_MS - (Date.now() - (lastHost.get(host) ?? 0));
    if (wait > 0) await sleep(Math.min(wait, PER_HOST_DELAY_MS));
    lastHost.set(host, Date.now());

    const check = await checkOne(row, fetchImpl, checkedAt);
    if (
      check.outcome !== "ok" &&
      client &&
      row.table !== ("static" as CatalogTable)
    ) {
      try {
        await markCatalogStatus({
          client,
          table: row.table,
          id: row.id,
          status: "stale",
          reviewedBy,
        });
        check.markedStale = true;
      } catch (err) {
        check.detail = `${check.detail ?? ""}; stale update failed: ${
          err instanceof Error ? err.message : String(err)
        }`.trim();
      }
    }
    checks.push(check);
  }

  const failed = checks.filter((c) => c.outcome !== "ok");
  return {
    generatedAt: checkedAt,
    runId,
    checks,
    summary: {
      ok: checks.length - failed.length,
      failed: failed.length,
      markedStale: checks.filter((c) => c.markedStale).length,
    },
  };
}

async function checkOne(
  row: CatalogSourceRow,
  fetchImpl: typeof fetch,
  checkedAt: string,
): Promise<SourceHealthCheck> {
  const base = {
    table: row.table,
    id: row.id,
    sourceUrl: row.sourceUrl,
    checkedAt,
  };

  try {
    const res = await fetchImpl(row.sourceUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 404 || res.status >= 400) {
      return {
        ...base,
        outcome: "http_error",
        httpStatus: res.status,
        detail: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    if (!html.trim()) {
      return {
        ...base,
        outcome: "empty_body",
        httpStatus: res.status,
        detail: "Empty body",
      };
    }

    const text = htmlToText(html);
    const claimOk = row.claims.some((c) => textContainsClaim(text, c));
    if (!claimOk) {
      return {
        ...base,
        outcome: "claim_missing",
        httpStatus: res.status,
        detail: `None of claims matched: ${row.claims.slice(0, 3).join(" | ")}`,
      };
    }

    return { ...base, outcome: "ok", httpStatus: res.status };
  } catch (err) {
    return {
      ...base,
      outcome: "unreachable",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatSourceHealthMarkdown(report: SourceHealthReport): string {
  const lines: string[] = [];
  lines.push(`# NorthTap source-health — verified catalog URLs`);
  lines.push("");
  lines.push(`- **Run ID:** \`${report.runId}\``);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(
    `- **OK / failed / marked stale:** ${report.summary.ok} / ${report.summary.failed} / ${report.summary.markedStale}`,
  );
  lines.push("");
  lines.push(
    `> Light daily check (GET + claim presence). Failures flip Supabase rows to \`status=stale\` when credentials are configured.`,
  );
  lines.push("");

  const failed = report.checks.filter((c) => c.outcome !== "ok");
  lines.push(`## Failures (${failed.length})`);
  lines.push("");
  if (failed.length === 0) {
    lines.push(`_None._`);
  } else {
    for (const c of failed) {
      lines.push(
        `- **[${c.outcome}] ${c.table}/${c.id}**${c.markedStale ? " → marked stale" : ""}`,
      );
      lines.push(`  - ${c.detail ?? c.outcome}`);
      lines.push(`  - <${c.sourceUrl}>`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
