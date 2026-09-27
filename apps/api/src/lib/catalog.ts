import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ASSET_RIGHTS_STATUSES,
  CARDS,
  LOYALTY_PROGRAMS,
  MERCHANT_BRANDS,
  MERCHANT_PARTNERSHIPS,
  type AssetRightsStatus,
  type CatalogAsset,
  type Category,
  type CreditCard,
  type LoyaltyProgram,
  type MerchantBrand,
  type MerchantPartnership,
  type PartnershipBenefit,
} from "@/domain";

export type CatalogSource = "static" | "supabase";

export function getCatalogSource(): CatalogSource {
  const raw = process.env.NORTHTAP_CATALOG_SOURCE?.trim().toLowerCase();
  if (raw === "supabase") return "supabase";
  return "static";
}

let supabase: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    supabase = null;
    return null;
  }
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

const RIGHTS_SET = new Set<string>(ASSET_RIGHTS_STATUSES);

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Maps `<prefix>_url`, `_alt`, `_source_url`, `_rights_status`, `_updated_at`. */
export function mapAsset(
  row: Record<string, unknown>,
  prefix: "image" | "logo",
): CatalogAsset {
  const rights = row[`${prefix}_rights_status`];
  const updatedAt = row[`${prefix}_updated_at`];
  return {
    url: nullableString(row[`${prefix}_url`]),
    alt: nullableString(row[`${prefix}_alt`]),
    sourceUrl: nullableString(row[`${prefix}_source_url`]),
    rightsStatus:
      typeof rights === "string" && RIGHTS_SET.has(rights)
        ? (rights as AssetRightsStatus)
        : rights == null
          ? "placeholder"
          : "unknown",
    updatedAt:
      updatedAt == null ? null : new Date(String(updatedAt)).toISOString(),
  };
}

export function mapCard(row: Record<string, unknown>): CreditCard {
  return {
    id: row.id as string,
    name: row.name as string,
    issuer: row.issuer as CreditCard["issuer"],
    annualFee: Number(row.annual_fee),
    pointCurrency: row.point_currency as CreditCard["pointCurrency"],
    rewardCategories: row.reward_categories as CreditCard["rewardCategories"],
    lastVerified: String(row.last_verified).slice(0, 10),
    welcomeOffer: (row.welcome_offer as CreditCard["welcomeOffer"]) ?? undefined,
    network: (row.network as CreditCard["network"]) ?? undefined,
    tier: (row.tier as string | null) ?? undefined,
    image: mapAsset(row, "image"),
  };
}

export function mapBrand(row: Record<string, unknown>): MerchantBrand {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Category,
    operator: (row.operator as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    sourceUrl: row.source_url as string,
    lastVerified: String(row.last_verified).slice(0, 10),
    logo: mapAsset(row, "logo"),
  };
}

export function mapProgram(row: Record<string, unknown>): LoyaltyProgram {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? undefined,
    pointCurrency:
      (row.point_currency as LoyaltyProgram["pointCurrency"]) ?? undefined,
    sourceUrl: row.source_url as string,
    lastVerified: String(row.last_verified).slice(0, 10),
    logo: mapAsset(row, "logo"),
  };
}

function mapPartnership(row: Record<string, unknown>): MerchantPartnership {
  return {
    id: row.id as string,
    merchantBrandIds: row.brand_ids as string[],
    loyaltyProgramId: (row.loyalty_program_id as string | null) ?? null,
    cardIds: row.card_ids as string[],
    affiliation: row.affiliation as MerchantPartnership["affiliation"],
    requirements: row.requirements as string,
    benefits: row.benefits as PartnershipBenefit[],
    stacksWithCardCategoryRewards: Boolean(
      row.stacks_with_card_category_rewards,
    ),
    notes: (row.notes as string | null) ?? undefined,
    sourceUrls: row.source_urls as string[],
    lastVerified: String(row.last_verified).slice(0, 10),
  };
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface CardFilters {
  issuer?: string;
  category?: string;
  pointCurrency?: string;
  network?: string;
  maxAnnualFee?: number;
  q?: string;
  limit: number;
  offset: number;
}

export interface BrandFilters {
  category?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface PartnershipFilters {
  cardId?: string;
  brandId?: string;
  loyaltyProgramId?: string;
  category?: string;
  status?: string;
  limit: number;
  offset: number;
}

function paginate<T>(items: T[], limit: number, offset: number): {
  data: T[];
  meta: PageMeta;
} {
  return {
    data: items.slice(offset, offset + limit),
    meta: { total: items.length, limit, offset },
  };
}

async function loadCardsFromDb(): Promise<CreditCard[]> {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("cards")
    .select("*")
    .eq("status", "verified")
    .order("issuer", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapCard(row as Record<string, unknown>));
}

async function loadBrandsFromDb(): Promise<MerchantBrand[]> {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("merchant_brands")
    .select("*")
    .eq("status", "verified")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapBrand(row as Record<string, unknown>));
}

async function loadProgramsFromDb(): Promise<LoyaltyProgram[]> {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("loyalty_programs")
    .select("*")
    .eq("status", "verified")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapProgram(row as Record<string, unknown>));
}

async function loadPartnershipsFromDb(
  includeNonVerified = false,
): Promise<MerchantPartnership[]> {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured");
  let query = client.from("merchant_partnerships").select("*");
  if (!includeNonVerified) {
    query = query.eq("status", "verified");
  }
  const { data, error } = await query.order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapPartnership(row as Record<string, unknown>),
  );
}

/** Public catalog: verified only. Static source mirrors the seed migration. */
export async function listCards(filters: CardFilters): Promise<{
  data: CreditCard[];
  meta: PageMeta;
}> {
  const source = getCatalogSource();
  let cards =
    source === "supabase" ? await loadCardsFromDb() : [...CARDS];

  if (filters.issuer) {
    cards = cards.filter((c) => c.issuer === filters.issuer);
  }
  if (filters.pointCurrency) {
    cards = cards.filter((c) => c.pointCurrency === filters.pointCurrency);
  }
  if (filters.network) {
    cards = cards.filter((c) => c.network === filters.network);
  }
  if (filters.maxAnnualFee !== undefined) {
    cards = cards.filter((c) => c.annualFee <= filters.maxAnnualFee!);
  }
  if (filters.category) {
    cards = cards.filter((c) =>
      c.rewardCategories.some(
        (r) => r.category === filters.category || r.category === "other",
      ),
    );
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }

  cards.sort(
    (a, b) =>
      a.issuer.localeCompare(b.issuer) || a.name.localeCompare(b.name),
  );

  return paginate(cards, filters.limit, filters.offset);
}

export async function getCard(id: string): Promise<CreditCard | null> {
  if (getCatalogSource() === "static") {
    return CARDS.find((c) => c.id === id) ?? null;
  }
  const client = getClient();
  if (!client) return null;
  const { data: row, error } = await client
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error) throw error;
  return row ? mapCard(row as Record<string, unknown>) : null;
}

export async function listAllVerifiedCards(): Promise<CreditCard[]> {
  if (getCatalogSource() === "static") return [...CARDS];
  return loadCardsFromDb();
}

export async function listLoyaltyPrograms(): Promise<LoyaltyProgram[]> {
  if (getCatalogSource() === "static") return [...LOYALTY_PROGRAMS];
  return loadProgramsFromDb();
}

export async function getLoyaltyProgram(
  id: string,
): Promise<LoyaltyProgram | null> {
  const programs = await listLoyaltyPrograms();
  return programs.find((p) => p.id === id) ?? null;
}

export async function listMerchantBrands(filters: BrandFilters): Promise<{
  data: MerchantBrand[];
  meta: PageMeta;
}> {
  let brands =
    getCatalogSource() === "static"
      ? [...MERCHANT_BRANDS]
      : await loadBrandsFromDb();

  if (filters.category) {
    brands = brands.filter((b) => b.category === filters.category);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    brands = brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q),
    );
  }
  brands.sort((a, b) => a.name.localeCompare(b.name));
  return paginate(brands, filters.limit, filters.offset);
}

export async function getMerchantBrand(
  id: string,
): Promise<MerchantBrand | null> {
  if (getCatalogSource() === "static") {
    return MERCHANT_BRANDS.find((b) => b.id === id) ?? null;
  }
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("merchant_brands")
    .select("*")
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error) throw error;
  return data ? mapBrand(data as Record<string, unknown>) : null;
}

export async function listAllVerifiedBrands(): Promise<MerchantBrand[]> {
  if (getCatalogSource() === "static") return [...MERCHANT_BRANDS];
  return loadBrandsFromDb();
}

export async function listAllVerifiedPartnerships(): Promise<
  MerchantPartnership[]
> {
  if (getCatalogSource() === "static") return [...MERCHANT_PARTNERSHIPS];
  return loadPartnershipsFromDb(false);
}

/** Verified brands + programs keyed by id, for nesting inside partnership payloads. */
export interface PartnershipRefs {
  brands: Map<string, MerchantBrand>;
  programs: Map<string, LoyaltyProgram>;
}

export async function loadPartnershipRefs(): Promise<PartnershipRefs> {
  const [brands, programs] = await Promise.all([
    listAllVerifiedBrands(),
    listLoyaltyPrograms(),
  ]);
  return {
    brands: new Map(brands.map((b) => [b.id, b])),
    programs: new Map(programs.map((p) => [p.id, p])),
  };
}

export async function listPartnerships(filters: PartnershipFilters): Promise<{
  data: Array<MerchantPartnership & { status: string }>;
  meta: PageMeta;
}> {
  // Public surface: only verified unless explicitly filtered (internal — still
  // only verified for anon API keys; non-verified is never returned here).
  let partnerships: Array<MerchantPartnership & { status: string }>;

  if (getCatalogSource() === "static") {
    partnerships = MERCHANT_PARTNERSHIPS.map((p) => ({
      ...p,
      status: "verified",
    }));
  } else {
    const raw = await loadPartnershipsFromDb(false);
    partnerships = raw.map((p) => ({ ...p, status: "verified" }));
  }

  if (filters.status && filters.status !== "verified") {
    // Non-verified rows are internal-only — return empty for public API.
    partnerships = [];
  }
  if (filters.cardId) {
    partnerships = partnerships.filter((p) =>
      p.cardIds.includes(filters.cardId!),
    );
  }
  if (filters.brandId) {
    partnerships = partnerships.filter((p) =>
      p.merchantBrandIds.includes(filters.brandId!),
    );
  }
  if (filters.loyaltyProgramId) {
    partnerships = partnerships.filter(
      (p) => p.loyaltyProgramId === filters.loyaltyProgramId,
    );
  }
  if (filters.category) {
    const brands = await listAllVerifiedBrands();
    const brandIds = new Set(
      brands.filter((b) => b.category === filters.category).map((b) => b.id),
    );
    partnerships = partnerships.filter((p) =>
      p.merchantBrandIds.some((id) => brandIds.has(id)),
    );
  }

  partnerships.sort((a, b) => a.id.localeCompare(b.id));
  return paginate(partnerships, filters.limit, filters.offset);
}

export async function getPartnership(
  id: string,
): Promise<(MerchantPartnership & { status: string }) | null> {
  const { data } = await listPartnerships({
    limit: 500,
    offset: 0,
  });
  return data.find((p) => p.id === id) ?? null;
}

export function resetCatalogClient(): void {
  supabase = undefined;
}
