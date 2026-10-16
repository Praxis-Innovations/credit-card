import { CARDS } from "@/domain";

/**
 * Parse a banking-app statement line into chain / store number / city.
 * Example: `WAL-MART SUPERCENTER #3124 TORONTO ON`
 */
export function parseStatementText(statementText: string): {
  chain: string;
  storeNumber: string | null;
  city: string | null;
  location: string | null;
  format: string | null;
} {
  const raw = statementText.trim().replace(/\s+/g, " ");
  const storeMatch = raw.match(/#(\d+)/);
  const storeNumber = storeMatch?.[1] ?? null;

  const cityMatch = raw.match(/\s([A-Z][A-Z\s]*?)\s([A-Z]{2})$/);
  let city: string | null = null;
  let withoutCity = raw;
  if (cityMatch) {
    city = cityMatch[1]!.trim();
    withoutCity = raw.slice(0, cityMatch.index).trim();
  }

  const withoutStore = withoutCity.replace(/\s*#\d+\s*/, " ").trim();
  const chain = withoutStore.replace(/\s+/g, " ");

  let format: string | null = null;
  if (/supercentre|supercenter/i.test(chain)) format = "supercentre";
  else if (/discount/i.test(chain)) format = "discount";

  const location = city;

  return { chain, storeNumber, city, location, format };
}

/** Exact catalog name match; otherwise suggest close names. */
export function resolveCatalogCardName(name: string): {
  cardId: string | null;
  didYouMean: string[];
} {
  const needle = name.trim().toLowerCase();
  const exact = CARDS.find(
    (c) => c.name.toLowerCase() === needle || c.id === needle,
  );
  if (exact) return { cardId: exact.id, didYouMean: [] };

  const scored = CARDS.map((c) => {
    const n = c.name.toLowerCase();
    let score = 0;
    if (n.includes(needle) || needle.includes(n)) score += 2;
    const a = new Set(needle.split(/\s+/));
    const b = new Set(n.split(/\s+/));
    for (const t of a) if (b.has(t)) score += 1;
    return { name: c.name, score };
  })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((s) => s.name);

  return { cardId: null, didYouMean: scored };
}
