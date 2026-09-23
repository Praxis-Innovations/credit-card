import type { DiffFinding, DiffReport, StagingSnapshot } from "./types";

/** Human-readable Markdown review report from a staging run + diff. */
export function formatDiffReportMarkdown(
  report: DiffReport,
  snapshot: StagingSnapshot,
): string {
  const lines: string[] = [];
  lines.push(`# NorthTap data-pipeline review — Big Six`);
  lines.push("");
  lines.push(`- **Run ID:** \`${report.runId}\``);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Staging captured:** ${snapshot.capturedAt}`);
  lines.push(`- **Pipeline version:** ${snapshot.pipelineVersion}`);
  lines.push(`- **Production Big Six cards:** ${report.productionCardCount}`);
  lines.push(`- **Staging facts:** ${report.stagingFactCount}`);
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
  lines.push(`| Source failures | ${report.summary.sourceFailures} |`);
  lines.push("");
  lines.push(
    `> Staging is **not** production. Nothing here is written to \`cards.ts\` or \`partnerships.ts\` until a human verifies and promotes it.`,
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
      title: "Partnership conflicts (verify before trusting catalog)",
      kinds: ["partnership_conflict"],
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
      lines.push(`- **${f.issuer}** / ${f.subject}`);
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
    `- **[${f.severity}] ${f.issuer} — ${f.subject}**`,
    `  - ${f.summary}`,
  ];
  if (f.productionValue !== undefined) {
    bits.push(`  - Production: \`${f.productionValue}\``);
  }
  if (f.stagingValue !== undefined) {
    bits.push(`  - Staging: \`${f.stagingValue}\``);
  }
  if (f.sourceUrls.length) {
    bits.push(`  - Sources: ${f.sourceUrls.map((u) => `<${u}>`).join(", ")}`);
  }
  return bits.join("\n");
}
