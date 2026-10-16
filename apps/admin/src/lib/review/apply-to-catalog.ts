import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCatalogWrite,
  cardIdFor,
  type BuildCatalogWriteInput,
  type CatalogWrite,
  type RewardCategory,
  type WelcomeOffer,
} from "./catalog-write";
import type { DiffKind, Extraction, ReviewFields } from "./types";

export type ApplyToCatalogInput = {
  findingId: string;
  linkedCardId: string | null;
  diffKind: DiffKind | null;
  cardName: string | null;
  issuerName: string | null;
  fields: ReviewFields;
  /** Raw extraction — used for point currency and indexed card-rule fields. */
  extracted?: Extraction | null;
};

export type ApplyToCatalogResult =
  | { ok: true; cardName: string | null; linkedCardId: string | null }
  | { ok: false; message: string };

type ExistingCard = NonNullable<BuildCatalogWriteInput["existing"]>;

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return list.length ? list : undefined;
}

function copyOptionalFields(out: RewardCategory, r: Record<string, unknown>): void {
  const capMonthly = optionalNumber(r.capMonthly);
  if (capMonthly != null) out.capMonthly = capMonthly;
  const capAnnual = optionalNumber(r.capAnnual);
  if (capAnnual != null) out.capAnnual = capAnnual;
  const mccs = optionalStringList(r.mccs);
  if (mccs) out.mccs = mccs;
  const merchants = optionalStringList(r.merchants);
  if (merchants) out.merchants = merchants;
  if (r.mccSource === "terms" || r.mccSource === "network_default") out.mccSource = r.mccSource;
  const exclusions = optionalStringList(r.exclusions);
  if (exclusions) out.exclusions = exclusions;
  const capGroup = optionalString(r.capGroup);
  if (capGroup) out.capGroup = capGroup;
  const rateAfterCap = optionalNumber(r.rateAfterCap);
  if (rateAfterCap != null) out.rateAfterCap = rateAfterCap;
  const tierThreshold = optionalNumber(r.tierThreshold);
  if (tierThreshold != null) out.tierThreshold = tierThreshold;
  const validFrom = optionalString(r.validFrom);
  if (validFrom) out.validFrom = validFrom;
  const validTo = optionalString(r.validTo);
  if (validTo) out.validTo = validTo;
  const quote = optionalString(r.quote);
  if (quote) out.quote = quote;
  const sourceUrl = optionalString(r.sourceUrl);
  if (sourceUrl) out.sourceUrl = sourceUrl;
}

function asRewardCategories(value: unknown): RewardCategory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const category = typeof r.category === "string" ? r.category : null;
      const earnRate = Number(r.earnRate);
      if (!category || !Number.isFinite(earnRate)) return null;
      const out: RewardCategory = { category, earnRate };
      copyOptionalFields(out, r);
      return out;
    })
    .filter((r): r is RewardCategory => r !== null);
}

function asWelcomeOffer(value: unknown): WelcomeOffer | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.summary !== "string" || !r.summary.trim()) return null;
  const offer: WelcomeOffer = { summary: r.summary };
  const estimated = optionalNumber(r.estimatedValueCad);
  if (estimated != null) offer.estimatedValueCad = estimated;
  const points = optionalNumber(r.points);
  if (points != null && Number.isInteger(points)) offer.points = points;
  const rate = optionalNumber(r.rate);
  if (rate != null) offer.rate = rate;
  const validFrom = optionalString(r.validFrom);
  if (validFrom) offer.validFrom = validFrom;
  const validTo = optionalString(r.validTo);
  if (validTo) offer.validTo = validTo;
  if (typeof r.newCardholdersOnly === "boolean") offer.newCardholdersOnly = r.newCardholdersOnly;
  return offer;
}

async function loadExistingCard(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true; card: ExistingCard } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("cards")
    .select("id, name, issuer, annual_fee, point_currency, reward_categories, welcome_offer, network")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: "Could not load the catalog card. Refresh and try again." };
  if (!data) return { ok: false, message: "This finding is not linked to a catalog card." };
  return {
    ok: true,
    card: {
      id: String(data.id),
      name: String(data.name),
      issuer: String(data.issuer),
      annual_fee: Number(data.annual_fee),
      point_currency: String(data.point_currency),
      reward_categories: asRewardCategories(data.reward_categories),
      welcome_offer: asWelcomeOffer(data.welcome_offer),
      network: (data.network as string | null) ?? null,
    },
  };
}

async function loadTakenIds(
  supabase: SupabaseClient,
  baseId: string,
): Promise<{ ok: true; ids: Set<string> } | { ok: false; message: string }> {
  const { data, error } = await supabase.from("cards").select("id").like("id", `${baseId}%`);
  if (error) return { ok: false, message: "Could not allocate a catalog id. Refresh and try again." };
  return { ok: true, ids: new Set((data ?? []).map((r) => String(r.id))) };
}

function cardOpPayload(write: CatalogWrite): Record<string, unknown> {
  if (write.op === "insert") return { op: "insert", row: write.row };
  return { op: "update", id: write.id, set: write.set };
}

const GONE = "That finding was already reviewed or no longer exists. Refresh the queue.";

function mapRpcError(message: string): string {
  if (/not authorized/i.test(message)) return "Your role can't make this change.";
  if (/duplicate key|unique constraint/i.test(message)) {
    return "A catalog card with this id already exists. Refresh and try again.";
  }
  if (/reviewed concurrently|not found|P0002/i.test(message)) return GONE;
  return "Could not update the catalog. Refresh and try again.";
}

async function resolveWriteContext(
  supabase: SupabaseClient,
  input: ApplyToCatalogInput,
): Promise<
  | { ok: true; existing: ExistingCard | null; takenIds: Set<string> | undefined }
  | { ok: false; message: string }
> {
  let existing: ExistingCard | null = null;
  let takenIds: Set<string> | undefined;

  if (input.diffKind === "changed" && input.linkedCardId) {
    const loaded = await loadExistingCard(supabase, input.linkedCardId);
    if (!loaded.ok) return loaded;
    existing = loaded.card;
  }

  if (input.diffKind === "new") {
    const issuer = input.issuerName ?? "";
    const name =
      input.fields.fields.find((f) => f.key === "name" && f.save)?.value.trim() || input.cardName || "";
    if (issuer && name) {
      const taken = await loadTakenIds(supabase, cardIdFor(issuer, name));
      if (!taken.ok) return taken;
      takenIds = taken.ids;
    }
  }

  return { ok: true, existing, takenIds };
}

/**
 * Approves a pending finding and writes accepted field values to `public.cards`
 * in one database transaction (RPC). There is no separate "Promote approved" UI.
 * Call once per finding — bulk approve should invoke this per row.
 */
export async function applyApprovedFindingToCatalog(
  supabase: SupabaseClient,
  input: ApplyToCatalogInput,
): Promise<ApplyToCatalogResult> {
  const ctx = await resolveWriteContext(supabase, input);
  if (!ctx.ok) return ctx;

  const built = buildCatalogWrite({
    diffKind: input.diffKind,
    linkedCardId: input.linkedCardId,
    cardName: input.cardName,
    issuerName: input.issuerName,
    fields: input.fields,
    existing: ctx.existing,
    extractedPointCurrency: input.extracted?.reward_currency?.value ?? null,
    extracted: input.extracted,
    takenIds: ctx.takenIds,
  });
  if (!built.ok) return built;

  const { data, error } = await supabase.rpc("approve_finding_to_catalog", {
    p_finding_id: input.findingId,
    p_review_fields: input.fields,
    p_card_op: built.write ? cardOpPayload(built.write) : null,
  });
  if (error) return { ok: false, message: mapRpcError(error.message ?? "") };
  if (!data) return { ok: false, message: GONE };

  const row = data as { card_name?: string | null; linked_card_id?: string | null };
  return {
    ok: true,
    cardName: row.card_name ?? input.cardName,
    linkedCardId: row.linked_card_id ?? input.linkedCardId,
  };
}
