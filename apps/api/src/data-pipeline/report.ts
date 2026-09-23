import type { DiffFinding, DiffReport, StagingSnapshot } from "./types";
import type { SourceHealthReport } from "./source-health";

/** Human-readable Markdown review report from a staging run + diff. */
export function formatDiffReportMarkdown(
  report: DiffReport,
  snapshot: StagingSnapshot,
): string {
  const lines: string[] = [];
  lines.push(`# NorthTap data-pipeline review — Big Six`);
  lines.push("");
  lines.push(`- **Run ID:** \`${report.runId}\``);
  lines.push(`- **Crawl scope:** \`${report.crawlScope}\` (cards monthly / partnerships bi-weekly / full on the 1st)`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Staging captured:** ${snapshot.capturedAt}`);
  lines.push(`- **Pipeline version:** ${snapshot.pipelineVersion}`);
  lines.push(`- **Production Big Six cards:** ${report.productionCardCount}`);
  lines.push(`- **Staging facts:** ${report.stagingFactCount}`);
  lines.push(
    `- **Suppressed (already rejected):** ${report.suppressedRejectedCount}`,
  );
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Signal | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| New card candidates | ${report.summary.newCardCandidates} |`);
  lines.push(`| Removed card candidates | ${report.summary.removedCardCandidates} |`);
  lines.push(`| Fee change candidates | ${report.summary.feeChanges} |`);
  lines.push(`| Earn-rate change candidates | ${report.summary.earnRateChanges} |`);
  lines.push(`| New partnership candidates | ${report.summary.newPartnershipCandidates} |`);
  lines.push(`| Partnership conflicts | ${report.summary.partnershipConflicts} |`);
  lines.push(`| Expiry reviews due | ${report.summary.expiryReviewsDue} |`);
  lines.push(`| Source failures | ${report.summary.sourceFailures} |`);
  lines.push("");
  lines.push(
    `> Staging is **not** production. Promote via \`pipeline:promote\` → Supabase \`status=verified\` (human-gated). Rejected fingerprints are persisted so they are not re-flagged weekly.`,
  );
  lines.push("");

  lines.push(`## Source attempts`);
  lines.push("");
  for (const s of snapshot.sources) {
    const status =
      s.outcome === "ok"
        ? `OK (${s.bytes ?? 0} bytes)`
        : `${s.outcome}${s.httpStatus ? ` HTTP ${s.httpStatus}` : ""}`;
    lines.push(`- **${s.sourceId}** (${s.issuer}) — ${status} — ${s.url}`);
  }
  lines.push("");

  const sections: Array<{ title: string; kinds: DiffFinding["kind"][] }> = [
    {
      title: "Partnership conflicts (with corroboration)",
      kinds: ["partnership_conflict"],
    },
    {
      title: "Expiry reviews due",
      kinds: ["expiry_review_due"],
    },
    {
      title: "Fee change candidates",
      kinds: ["fee_change_candidate"],
    },
    {
      title: "Earn-rate / currency change candidates",
      kinds: ["earn_rate_change_candidate", "point_currency_change_candidate"],
    },
    {
      title: "New card candidates",
      kinds: ["new_card_candidate"],
    },
    {
      title: "New partnership candidates",
      kinds: ["new_partnership_candidate"],
    },
    {
      title: "Possibly missing from listing pages",
      kinds: ["removed_card_candidate"],
    },
    {
      title: "Source failures",
      kinds: ["source_failure"],
    },
    {
      title: "Source-health failures",
      kinds: ["source_health_failure"],
    },
  ];

  for (const section of sections) {
    const items = report.findings.filter((f) => section.kinds.includes(f.kind));
    lines.push(`## ${section.title}`);
    lines.push("");
    if (items.length === 0) {
      lines.push(`_None._`);
      lines.push("");
      continue;
    }
    for (const f of items) {
      lines.push(formatFinding(f));
    }
    lines.push("");
  }

  const confirmed = report.findings.filter((f) => f.kind === "unchanged_signal");
  lines.push(`## Confirmed catalog mentions (${confirmed.length})`);
  lines.push("");
  if (confirmed.length === 0) {
    lines.push(`_None detected._`);
  } else {
    for (const f of confirmed.slice(0, 80)) {
      lines.push(`- **${f.issuer}** / ${f.subject} (\`${f.fingerprint.slice(0, 8)}\`)`);
    }
    if (confirmed.length > 80) {
      lines.push(`- _…and ${confirmed.length - 80} more_`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function formatFinding(f: DiffFinding): string {
  const bits = [
    `- **[${f.severity}/${f.status}] ${f.issuer} — ${f.subject}**`,
    `  - fingerprint: \`${f.fingerprint}\``,
    `  - ${f.summary}`,
  ];
  if (f.productionValue !== undefined) {
    bits.push(`  - Production: \`${f.productionValue}\``);
  }
  if (f.stagingValue !== undefined) {
    bits.push(`  - Staging: \`${f.stagingValue}\``);
  }
  if (f.expiresAt) {
    bits.push(`  - Expires: \`${f.expiresAt}\``);
  }
  if (f.corroboration) {
    bits.push(
      `  - Corroboration: ${f.corroboration.note}${
        f.corroboration.thirdSourceUrl
          ? ` (<${f.corroboration.thirdSourceUrl}>)`
          : ""
      }${
        f.corroboration.agreesWith
          ? ` — agreesWith=\`${f.corroboration.agreesWith}\``
          : ""
      }`,
    );
    if (f.corroboration.thirdValue) {
      bits.push(`  - Third-source snippet: \`${f.corroboration.thirdValue}\``);
    }
  }
  if (f.sourceUrls.length) {
    bits.push(`  - Sources: ${f.sourceUrls.map((u) => `<${u}>`).join(", ")}`);
  }
  return bits.join("\n");
}

export function appendHealthToReviewMarkdown(
  base: string,
  health: SourceHealthReport,
): string {
  if (health.summary.failed === 0) return base;
  return `${base}\n---\n\n## Immediate: source-health failures\n\n${health.checks
    .filter((c) => c.outcome !== "ok")
    .map(
      (c) =>
        `- **${c.table}/${c.id}** [${c.outcome}]${c.markedStale ? " → stale" : ""} — <${c.sourceUrl}>`,
    )
    .join("\n")}\n`;
}
