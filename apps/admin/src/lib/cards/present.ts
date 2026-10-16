import type { PillTone } from "@/lib/sources/present";
import type { Extraction } from "@/lib/review/types";
import type {
  AssetRightsStatus,
  CatalogCard,
  CatalogStatus,
  FieldSource,
  RewardCategory,
  WelcomeOffer,
} from "./types";

export type CatalogFieldRow = {
  key: string;
  label: string;
  value: string;
  source: FieldSource | null;
};

export function catalogStatusPill(status: CatalogStatus): { label: string; tone: PillTone } {
  switch (status) {
    case "verified":
      return { label: "Verified", tone: "ok" };
    case "pending":
      return { label: "Pending", tone: "warn" };
    case "stale":
      return { label: "Stale", tone: "neutral" };
    case "rejected":
      return { label: "Rejected", tone: "bad" };
  }
}

export function imageRightsLabel(rights: AssetRightsStatus): string {
  switch (rights) {
    case "generated":
      return "Generated";
    case "placeholder":
      return "Placeholder";
    case "licensed":
      return "Licensed";
    case "issuer_provided":
      return "Issuer provided";
    case "unknown":
      return "Unknown";
  }
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function showWelcome(offer: WelcomeOffer): string {
  if (!offer) return "none";
  const parts: string[] = [];
  if (offer.summary) parts.push(offer.summary);
  if (offer.estimatedValueCad != null) parts.push(`~$${offer.estimatedValueCad} CAD`);
  return parts.length > 0 ? parts.join(" · ") : "none";
}

function showEarnRate(r: RewardCategory): string {
  const rate = `${r.earnRate}`;
  if (r.capMonthly != null && r.capMonthly > 0) {
    return `${rate} (cap $${r.capMonthly}/mo)`;
  }
  return rate;
}

/** Map extraction quotes onto catalog field keys for the Source column. */
export function quotesFromExtraction(extracted: Extraction | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!extracted) return out;
  if (extracted.card_name?.quote) out.set("name", extracted.card_name.quote);
  if (extracted.network?.quote) out.set("network", extracted.network.quote);
  if (extracted.annual_fee?.quote) out.set("annual_fee", extracted.annual_fee.quote);
  if (extracted.reward_currency?.quote) out.set("point_currency", extracted.reward_currency.quote);
  if (extracted.welcome_bonus?.quote) out.set("welcome_offer", extracted.welcome_bonus.quote);
  for (const e of extracted.earn_rates ?? []) {
    const key = `earn_rate.${e.category}`;
    if (e.quote && !out.has(key)) out.set(key, e.quote);
  }
  return out;
}

function sourceFor(quotes: Map<string, string>, key: string, label: string): FieldSource | null {
  const quote = quotes.get(key);
  if (quote === undefined) return null;
  return { quote, label };
}

/** Read-only field rows for Card detail (values + optional source quote). */
export function buildCatalogFieldRows(
  card: CatalogCard,
  extracted: Extraction | null | undefined,
): CatalogFieldRow[] {
  const quotes = quotesFromExtraction(extracted);
  const rows: CatalogFieldRow[] = [
    { key: "name", label: "Card name", value: card.name, source: sourceFor(quotes, "name", "Latest approved finding") },
    {
      key: "network",
      label: "Network",
      value: card.network ?? "none",
      source: sourceFor(quotes, "network", "Latest approved finding"),
    },
    { key: "tier", label: "Tier", value: card.tier ?? "none", source: null },
    {
      key: "annual_fee",
      label: "Annual fee",
      value: money(Number(card.annual_fee)),
      source: sourceFor(quotes, "annual_fee", "Latest approved finding"),
    },
    {
      key: "point_currency",
      label: "Point currency",
      value: card.point_currency,
      source: sourceFor(quotes, "point_currency", "Latest approved finding"),
    },
    {
      key: "welcome_offer",
      label: "Welcome offer",
      value: showWelcome(card.welcome_offer),
      source: sourceFor(quotes, "welcome_offer", "Latest approved finding"),
    },
    {
      key: "image",
      label: "Card image",
      value: imageRightsLabel(card.image_rights_status),
      source: card.image_source_url
        ? { quote: null, label: card.image_source_url }
        : { quote: null, label: imageRightsLabel(card.image_rights_status) },
    },
    {
      key: "last_verified",
      label: "Last verified",
      value: card.last_verified,
      source: null,
    },
  ];

  const rates = Array.isArray(card.reward_categories) ? card.reward_categories : [];
  for (const r of rates) {
    const key = `earn_rate.${r.category}`;
    rows.push({
      key,
      label: `Earn rate: ${categoryLabel(r.category)}`,
      value: showEarnRate(r),
      source: sourceFor(quotes, key, "Latest approved finding"),
    });
  }

  return rows;
}

export function auditActionLabel(action: string): string {
  switch (action) {
    case "card.retire":
      return "Retired";
    case "card.approve_insert":
      return "Added from review";
    case "card.approve_update":
      return "Updated from review";
    default:
      return action.replace(/^card\./, "").replace(/_/g, " ");
  }
}

/** Unique issuers, sorted, for the type-to-search filter. */
export function uniqueIssuers(cards: readonly { issuer: string }[]): string[] {
  return [...new Set(cards.map((c) => c.issuer))].sort((a, b) => a.localeCompare(b));
}

export function filterCards<T extends { name: string; issuer: string; status: CatalogStatus; id: string }>(
  cards: readonly T[],
  opts: { query: string; issuer: string; status: string },
): T[] {
  const q = opts.query.trim().toLowerCase();
  const issuer = opts.issuer.trim().toLowerCase();
  return cards.filter((c) => {
    if (opts.status !== "all" && c.status !== opts.status) return false;
    if (issuer && !c.issuer.toLowerCase().includes(issuer)) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.issuer.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });
}
