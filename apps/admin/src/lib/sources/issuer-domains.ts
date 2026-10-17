/**
 * Official domains for the catalog issuers. A compare URL must be on one of
 * these (or a subdomain). Issuers not listed fall back to a name match on the
 * registrable domain, which keeps aggregator and affiliate sites out.
 */
export const ISSUER_DOMAINS: Record<string, readonly string[]> = {
  "american express": ["americanexpress.com"],
  bmo: ["bmo.com"],
  brim: ["brimfinancial.com"],
  "canadian tire": ["canadiantire.ca", "ctfs.com", "triangle.com"],
  cibc: ["cibc.com"],
  desjardins: ["desjardins.com"],
  hsbc: ["hsbc.ca"],
  mbna: ["mbna.ca"],
  "national bank": ["nbc.ca", "bnc.ca"],
  neo: ["neofinancial.com"],
  "pc financial": ["pcfinancial.ca"],
  rbc: ["rbcroyalbank.com", "rbc.com"],
  rogers: ["rogersbank.com", "rogers.com"],
  scotiabank: ["scotiabank.com"],
  simplii: ["simplii.com"],
  tangerine: ["tangerine.ca"],
  td: ["td.com", "tdcanadatrust.com"],
};

const GENERIC_WORDS = new Set([
  "bank",
  "banque",
  "card",
  "cards",
  "credit",
  "financial",
  "finance",
  "canada",
  "trust",
  "group",
  "the",
]);

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac"]);

function normalizeIssuer(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function knownDomainsFor(issuerName: string): readonly string[] | undefined {
  return ISSUER_DOMAINS[normalizeIssuer(issuerName)];
}

/** "www.example.co.uk" → "example.co.uk"; "cards.td.com" → "td.com". */
export function registrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/\.$/, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const tld = parts[parts.length - 1]!;
  const sld = parts[parts.length - 2]!;
  const take = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return parts.slice(-take).join(".");
}

export function isIssuerDomain(hostname: string, issuerName: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const known = knownDomainsFor(issuerName);
  if (known) return known.some((d) => host === d || host.endsWith(`.${d}`));

  const label = registrableDomain(host).split(".")[0] ?? "";
  const words = normalizeIssuer(issuerName)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const compact = words.join("");
  const tokens = [compact, ...words.filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w))];
  return tokens.some((t) => t.length >= 2 && label.includes(t));
}
