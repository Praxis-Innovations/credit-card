import {
  applyPromotions,
  applyWelcomeOffer,
  hasWelcomeDecisions,
} from "./catalog-write-offers";
import { isEmpty, parseNonNegNumber } from "./catalog-write-parse";
import {
  applyEarnRates,
  hasEarnRuleDecisions,
  type RewardCategory,
  type WelcomeOffer,
} from "./catalog-write-rules";
import type { DiffKind, Extraction, FieldDecision, ReviewFields } from "./types";

export type { RewardCategory, WelcomeOffer };

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
  /** Full extraction — needed to map indexed earn_rates / promotions. */
  extracted?: Extraction | null;
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

function saved(fields: ReviewFields): Map<string, FieldDecision> {
  return new Map(fields.fields.filter((f) => f.save).map((f) => [f.key, f]));
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

function applyRewardRules(
  base: RewardCategory[],
  decisions: Map<string, FieldDecision>,
  extracted: Extraction | null | undefined,
): { ok: true; categories: RewardCategory[] } | { ok: false; message: string } {
  const rates = applyEarnRates(base, decisions, extracted?.earn_rates);
  if (!rates.ok) return { ok: false, message: rates.message };
  const withPromos = applyPromotions(rates.value, decisions, extracted?.promotions);
  if (!withPromos.ok) return { ok: false, message: withPromos.message };
  return { ok: true, categories: withPromos.value };
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
  if (hasEarnRuleDecisions(decisions)) {
    const rates = applyRewardRules(input.existing.reward_categories, decisions, input.extracted);
    if (!rates.ok) return rates;
    set.reward_categories = rates.categories;
  }
  if (hasWelcomeDecisions(decisions)) {
    const welcome = applyWelcomeOffer(input.existing.welcome_offer, decisions);
    if (!welcome.ok) return { ok: false, message: welcome.message };
    set.welcome_offer = welcome.value;
  }

  return { ok: true, write: { op: "update", id: input.linkedCardId, set } };
}

function newCardFeeAndNetwork(
  decisions: Map<string, FieldDecision>,
): { ok: true; annual_fee: number; network: CatalogNetwork } | { ok: false; message: string } {
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
  return { ok: true, annual_fee, network };
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

  const basics = newCardFeeAndNetwork(decisions);
  if (!basics.ok) return basics;

  const rates = applyRewardRules([], decisions, input.extracted);
  if (!rates.ok) return rates;
  const welcome = applyWelcomeOffer(null, decisions);
  if (!welcome.ok) return { ok: false, message: welcome.message };
  const reward_categories =
    rates.categories.length > 0 ? rates.categories : [{ category: "other", earnRate: 1 }];

  return {
    ok: true,
    write: {
      op: "insert",
      row: {
        id: uniqueCardId(cardIdFor(issuer, name), input.takenIds ?? new Set()),
        name,
        issuer,
        annual_fee: basics.annual_fee,
        point_currency: normalizePointCurrency(input.extractedPointCurrency),
        reward_categories,
        welcome_offer: welcome.value,
        network: basics.network,
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
