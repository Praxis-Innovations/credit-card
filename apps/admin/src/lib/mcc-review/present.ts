import type { BrandSnapshot, CatalogStatus, MerchantCodeFinding, MccCertainty } from "./types";

export function chainFromFinding(finding: MerchantCodeFinding): string {
  const p = finding.proposed;
  const chain = typeof p.chain === "string" ? p.chain.trim() : "";
  if (chain) return chain;
  const location = typeof p.location === "string" ? p.location.trim() : "";
  if (location) return location;
  return "Unknown chain";
}

export function proposedMcc(finding: MerchantCodeFinding): string | null {
  const p = finding.proposed;
  if (finding.kind === "store_code" && typeof p.mcc === "string") return p.mcc;
  if (finding.kind === "test_purchase" && typeof p.mcc_shown === "string" && p.mcc_shown) {
    return p.mcc_shown;
  }
  if (typeof p.mcc === "string") return p.mcc;
  return null;
}

export function proposedQuote(finding: MerchantCodeFinding): string | null {
  const p = finding.proposed;
  if (typeof p.quote === "string" && p.quote.trim()) return p.quote.trim();
  if (typeof p.statement_text === "string" && p.statement_text.trim()) {
    return p.statement_text.trim();
  }
  return null;
}

export function proposedSourceUrl(finding: MerchantCodeFinding): string | null {
  const p = finding.proposed;
  if (typeof p.url === "string" && p.url) return p.url;
  if (typeof p.source_url === "string" && p.source_url) return p.source_url;
  return null;
}

export type ChainGroup = {
  chain: string;
  brand: BrandSnapshot | null;
  findings: MerchantCodeFinding[];
  currentMcc: string | null;
  proposedMccs: string[];
};

function brandForChain(brands: BrandSnapshot[], chain: string): BrandSnapshot | null {
  const lower = chain.toLowerCase();
  return brands.find((b) => b.name.toLowerCase() === lower) ?? null;
}

/** Group pending store-code findings by chain (case-insensitive), newest first. */
export function groupFindingsByChain(
  findings: MerchantCodeFinding[],
  brands: BrandSnapshot[],
): ChainGroup[] {
  const map = new Map<string, ChainGroup>();

  for (const finding of findings) {
    const chain = chainFromFinding(finding);
    const key = chain.toLowerCase();
    let group = map.get(key);
    if (!group) {
      const brand = brandForChain(brands, chain);
      group = {
        chain,
        brand,
        findings: [],
        currentMcc: brand?.mcc ?? brand?.amex_mcc ?? null,
        proposedMccs: [],
      };
      map.set(key, group);
    }
    group.findings.push(finding);
    const mcc = proposedMcc(finding);
    if (mcc && !group.proposedMccs.includes(mcc)) group.proposedMccs.push(mcc);
  }

  return [...map.values()].sort((a, b) => a.chain.localeCompare(b.chain, "en"));
}

const CERTAINTY_LABELS: Record<MccCertainty, string> = {
  confirmed: "Confirmed",
  varies_by_store: "Varies by store",
  varies_by_network: "Varies by network",
  varies_by_product: "Varies by product",
  category_only: "Category only",
  estimate: "Estimate",
  unknown: "Unknown",
};

export function certaintyLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return CERTAINTY_LABELS[value as MccCertainty] ?? value;
}

export function statusLabel(status: CatalogStatus | string | null | undefined): {
  label: string;
  tone: "ok" | "neutral" | "bad" | "warn";
} {
  switch (status) {
    case "verified":
      return { label: "Verified", tone: "ok" };
    case "conflict":
      return { label: "Conflict", tone: "bad" };
    case "stale":
      return { label: "Stale", tone: "warn" };
    case "rejected":
      return { label: "Rejected", tone: "neutral" };
    default:
      return { label: "Pending", tone: "warn" };
  }
}

export function sourceTypeLabel(value: string | null | undefined): string {
  if (!value) return "Unknown source";
  return value.replaceAll("_", " ");
}
