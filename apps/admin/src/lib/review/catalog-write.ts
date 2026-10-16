import type { DiffKind, FieldDecision, ReviewFields } from "./types";

/** Columns the approve path may set on public.cards. */
type CatalogCardRow = {
  id: string;
  name: string;
  issuer: string;
  annual_fee: number;
  point_currency: string;
  reward_categories: RewardCategory[];
  welcome_offer: WelcomeOffer | null;
  network: CatalogNetwork;
  last_verified: string;
  verified_at: string;
  status: "verified";
};

export type RewardCategory = {
  category: string;
  earnRate: number;
  capMonthly?: number;
  capAnnual?: number;
};

export type WelcomeOffer = {
  summary: string;
  estimatedValueCad?: number;
};

type CatalogNetwork = "Visa" | "Mastercard" | "Amex" | null;

type CatalogCardUpdate = Partial<
  Pick<CatalogCardRow, "name" | "annual_fee" | "network" | "reward_categories" | "welcome_offer">
> & {
  last_verified: string;
  verified_at: string;
  status: "verified";
};

export type CatalogWrite =
  | { op: "insert"; row: CatalogCardRow }
  | { op: "update"; id: string; set: CatalogCardUpdate };

export type BuildCatalogWriteInput = {
  diffKind: DiffKind | null;
  linkedCardId: string | null;
  cardName: string | null;
  issuerName: string | null;
  fields: ReviewFields;
  /** Existing catalog row when updating a linked card (reward merge). */
  existing: {
    id: string;
    name: string;
    issuer: string;
    annual_fee: number;
    point_currency: string;
    reward_categories: RewardCategory[];
    welcome_offer: WelcomeOffer | null;
    network: string | null;
  } | null;
  /** From extraction when review fields don't cover it (new cards). */
  extractedPointCurrency: string | null;
  /** Today (YYYY-MM-DD) and ISO timestamp — injectable for tests. */
  now?: { date: string; iso: string };
  /** Existing card ids that would collide with a generated slug. */
  takenIds?: ReadonlySet<string>;
};

const NETWORK_TO_CATALOG: Record<string, Exclude<CatalogNetwork, null>> = {
  Visa: "Visa",
  Mastercard: "Mastercard",
  "American Express": "Amex",
  Amex: "Amex",
};

/** First matching substring → catalog point_currency. */
const POINT_CURRENCY_HINTS: Array<[string, string]> = [
  ["scene", "Scene+"],
  ["aeroplan", "Aeroplan"],
  ["avion", "RBC Avion"],
  ["aventura", "CIBC Aventura"],
  ["membership rewards", "Amex MR"],
  ["amex mr", "Amex MR"],
  ["air miles", "AIR MILES"],
  ["td rewards", "TD Rewards"],
  ["pc optimum", "PC Optimum"],
  ["pc points", "PC Optimum"],
  ["marriott", "Marriott Bonvoy"],
  ["westjet", "WestJet"],
  ["triangle", "Triangle"],
  ["cash", "cashback"],
  ["bmo", "BMO Rewards"],
  ["rogers", "Rogers"],
  ["moi", "Moi"],
];

const EMPTY = "none";

function saved(fields: ReviewFields): Map<string, FieldDecision> {
  return new Map(fields.fields.filter((f) => f.save).map((f) => [f.key, f]));
}

function isEmpty(value: string): boolean {
  return value.trim() === "" || value.trim().toLowerCase() === EMPTY;
}

function parseNonNegNumber(value: string, integer: boolean): number | null {
  if (isEmpty(value)) return null;
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

/** Stable catalog id from issuer + card name (e.g. scotiabank-gold-amex). */
export function cardIdFor(issuer: string, name: string): string {
  const raw = `${issuer} ${name}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/american express/g, "amex")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return (raw || "card").slice(0, 80);
}

export function uniqueCardId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const id = `${base.slice(0, 76)}-${i}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("Could not allocate a unique card id.");
}

function mapNetwork(value: string): CatalogNetwork | undefined {
  if (isEmpty(value)) return null;
  return NETWORK_TO_CATALOG[value.trim()] ?? undefined;
}

function normalizePointCurrency(raw: string | null): string {
  if (!raw || !raw.trim()) return "cashback";
  const lower = raw.trim().toLowerCase();
  if (lower === "mr") return "Amex MR";
  for (const [hint, currency] of POINT_CURRENCY_HINTS) {
    if (lower.includes(hint)) return currency;
  }
  return raw.trim().slice(0, 64);
}

function applyEarnRates(
  base: RewardCategory[],
  decisions: Map<string, FieldDecision>,
): { ok: true; categories: RewardCategory[] } | { ok: false; message: string } {
  const byCat = new Map(base.map((r) => [r.category, { ...r }]));
  for (const [key, d] of decisions) {
    if (!key.startsWith("earn_rate.")) continue;
    const category = key.slice("earn_rate.".length);
    if (!category) return { ok: false, message: `Invalid earn-rate field ${key}.` };
    const rate = parseNonNegNumber(d.value, false);
    if (rate === null) return { ok: false, message: `Enter a valid earn rate for ${category}.` };
    const prev = byCat.get(category);
    byCat.set(category, prev ? { ...prev, earnRate: rate } : { category, earnRate: rate });
  }
  const categories = [...byCat.values()];
  if (categories.length === 0) categories.push({ category: "other", earnRate: 1 });
  return { ok: true, categories };
}

function applyWelcomePoints(
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
): { ok: true; offer: WelcomeOffer | null } | { ok: false; message: string } {
  const d = decisions.get("welcome_bonus.points");
  if (!d) return { ok: true, offer: current };
  const points = parseNonNegNumber(d.value, true);
  if (points === null && !isEmpty(d.value)) {
    return { ok: false, message: "Enter a valid welcome-bonus points value." };
  }
  if (points === null) return { ok: true, offer: null };
  if (current?.summary) {
    const replaced = current.summary.replace(/(\d{1,3}(?:,\d{3})+|\d+)/, String(points));
    return {
      ok: true,
      offer: {
        ...current,
        summary: replaced === current.summary ? `${points} points after qualifying spend` : replaced,
      },
    };
  }
  return { ok: true, offer: { summary: `${points} points after qualifying spend` } };
}

export type BuildCatalogWriteResult =
  | { ok: true; write: CatalogWrite | null }
  | { ok: false; message: string };

function clock(input: BuildCatalogWriteInput): { date: string; iso: string } {
  return (
    input.now ?? {
      date: new Date().toISOString().slice(0, 10),
      iso: new Date().toISOString(),
    }
  );
}

function buildChangedWrite(
  input: BuildCatalogWriteInput,
  decisions: Map<string, FieldDecision>,
  now: { date: string; iso: string },
): BuildCatalogWriteResult {
  if (!input.linkedCardId || !input.existing) {
    return { ok: false, message: "This finding is not linked to a catalog card." };
  }
  if (input.existing.id !== input.linkedCardId) {
    return { ok: false, message: "Catalog card mismatch. Refresh and try again." };
  }
  if (decisions.size === 0) return { ok: true, write: null };

  const set: CatalogCardUpdate = {
    last_verified: now.date,
    verified_at: now.iso,
    status: "verified",
  };

  if (decisions.has("name")) {
    const name = decisions.get("name")!.value.trim();
    if (isEmpty(name)) return { ok: false, message: "Card name cannot be empty." };
    set.name = name;
  }
  if (decisions.has("annual_fee")) {
    const fee = parseNonNegNumber(decisions.get("annual_fee")!.value, false);
    if (fee === null) return { ok: false, message: "Enter a valid annual fee." };
    set.annual_fee = fee;
  }
  if (decisions.has("network")) {
    const network = mapNetwork(decisions.get("network")!.value);
    if (network === undefined) return { ok: false, message: "Enter Visa, Mastercard, or American Express." };
    set.network = network;
  }
  if ([...decisions.keys()].some((k) => k.startsWith("earn_rate."))) {
    const rates = applyEarnRates(input.existing.reward_categories, decisions);
    if (!rates.ok) return rates;
    set.reward_categories = rates.categories;
  }
  if (decisions.has("welcome_bonus.points")) {
    const welcome = applyWelcomePoints(input.existing.welcome_offer, decisions);
    if (!welcome.ok) return welcome;
    set.welcome_offer = welcome.offer;
  }

  return { ok: true, write: { op: "update", id: input.linkedCardId, set } };
}

function buildNewWrite(
  input: BuildCatalogWriteInput,
  decisions: Map<string, FieldDecision>,
  now: { date: string; iso: string },
): BuildCatalogWriteResult {
  const issuer = (input.issuerName ?? "").trim();
  if (!issuer) return { ok: false, message: "Issuer is required to create a catalog card." };

  const name = (decisions.get("name")?.value ?? input.cardName ?? "").trim();
  if (!name || isEmpty(name)) return { ok: false, message: "Card name is required to create a catalog card." };

  let annual_fee = 0;
  if (decisions.has("annual_fee")) {
    const fee = parseNonNegNumber(decisions.get("annual_fee")!.value, false);
    if (fee === null) return { ok: false, message: "Enter a valid annual fee." };
    annual_fee = fee;
  }

  let network: CatalogNetwork = null;
  if (decisions.has("network")) {
    const mapped = mapNetwork(decisions.get("network")!.value);
    if (mapped === undefined) return { ok: false, message: "Enter Visa, Mastercard, or American Express." };
    network = mapped;
  }

  const rates = applyEarnRates([], decisions);
  if (!rates.ok) return rates;
  const welcome = applyWelcomePoints(null, decisions);
  if (!welcome.ok) return welcome;

  return {
    ok: true,
    write: {
      op: "insert",
      row: {
        id: uniqueCardId(cardIdFor(issuer, name), input.takenIds ?? new Set()),
        name,
        issuer,
        annual_fee,
        point_currency: normalizePointCurrency(input.extractedPointCurrency),
        reward_categories: rates.categories,
        welcome_offer: welcome.offer,
        network,
        last_verified: now.date,
        verified_at: now.iso,
        status: "verified",
      },
    },
  };
}

/**
 * Turns per-field approve decisions into a cards insert/update, or null when
 * the finding should not touch the catalog (possibly discontinued, or nothing
 * to save on a changed card).
 */
export function buildCatalogWrite(input: BuildCatalogWriteInput): BuildCatalogWriteResult {
  const { diffKind } = input;
  if (diffKind === "possibly_discontinued" || diffKind === "unchanged" || diffKind == null) {
    return { ok: true, write: null };
  }
  const decisions = saved(input.fields);
  const now = clock(input);
  if (diffKind === "changed") return buildChangedWrite(input, decisions, now);
  if (diffKind === "new") return buildNewWrite(input, decisions, now);
  return { ok: true, write: null };
}
