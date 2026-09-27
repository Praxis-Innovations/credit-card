import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARDS,
  LOYALTY_PROGRAMS,
  MERCHANT_BRANDS,
  MERCHANT_PARTNERSHIPS,
} from "@/domain";
import {
  clearStaticApiKeys,
  hashApiKey,
  registerStaticApiKey,
  resetAuthClient,
} from "./auth";
import { resetCatalogClient } from "./catalog";
import { resetRateLimits } from "./rate-limit";
import { GET as getCards } from "../app/v1/cards/route";
import { GET as getCard } from "../app/v1/cards/[id]/route";
import { GET as getLoyaltyPrograms } from "../app/v1/loyalty-programs/route";
import { GET as getLoyaltyProgram } from "../app/v1/loyalty-programs/[id]/route";
import { GET as getMerchantBrands } from "../app/v1/merchant-brands/route";
import { GET as getMerchantBrand } from "../app/v1/merchant-brands/[id]/route";
import { GET as getBrandPartnerships } from "../app/v1/merchant-brands/[id]/partnerships/route";
import { GET as getPartnerships } from "../app/v1/partnerships/route";
import { GET as getPartnership } from "../app/v1/partnerships/[id]/route";
import { POST as postRecommendations } from "../app/v1/recommendations/route";

// ── Stub Supabase client (only used when SUPABASE_URL is set) ─────────────

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      let rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        order: () => builder,
        eq(column: string, value: unknown) {
          rows = rows.filter((r) => r[column] === value);
          return builder;
        },
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return builder;
    },
  }),
}));

// ── OpenAPI validation ─────────────────────────────────────────────────────

const spec = parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../docs/api/openapi.yaml",
    ),
    "utf8",
  ),
) as { components: { schemas: Record<string, unknown> } };

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({
  $id: "openapi",
  $defs: JSON.parse(
    JSON.stringify(spec.components.schemas).replaceAll(
      "#/components/schemas/",
      "#/$defs/",
    ),
  ),
});

function expectSchema(name: string, body: unknown): void {
  const validate = ajv.getSchema(`openapi#/$defs/${name}`);
  if (!validate) throw new Error(`No schema ${name} in openapi.yaml`);
  if (!validate(body)) {
    throw new Error(`${name}: ${ajv.errorsText(validate.errors)}`);
  }
}

// ── Request helpers ────────────────────────────────────────────────────────

const TEST_API_KEY = "test-api-key-not-a-production-secret";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function get(p: string): Request {
  return new Request(`http://localhost:8787${p}`, {
    headers: { "X-Api-Key": TEST_API_KEY },
  });
}

function recommend(body: unknown): Request {
  return new Request("http://localhost:8787/v1/recommendations", {
    method: "POST",
    headers: { "X-Api-Key": TEST_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function ok<T = Row>(res: Response): Promise<T> {
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

const SHELL_AT_PUMP = {
  amountCad: 60,
  category: "gas",
  merchantQuery: "Shell",
  ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback"],
};

beforeEach(() => {
  resetRateLimits();
  clearStaticApiKeys();
  registerStaticApiKey(TEST_API_KEY);
});

describe("openapi validator", () => {
  it("rejects payloads missing the asset fields", () => {
    const { image: _image, ...card } = CARDS[0]!;
    expect(() => expectSchema("CreditCard", card)).toThrow(/imageUrl/);
    expect(() =>
      expectSchema("CreditCard", { ...card, imageUrl: null, imageAlt: null, image: {} }),
    ).toThrow(/additional/);
    expect(() =>
      expectSchema("LogoSummary", { id: "shell", name: "Shell", logoUrl: 42, logoAlt: null }),
    ).toThrow(/logoUrl/);
  });
});

// ── Static catalog: every asset is null ────────────────────────────────────

describe("contract: static catalog (assets null)", () => {
  beforeAll(() => {
    process.env.NORTHTAP_CATALOG_SOURCE = "static";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetCatalogClient();
    resetAuthClient();
  });

  it("GET /v1/cards and /v1/cards/:id carry imageUrl/imageAlt = null", async () => {
    const list = await ok<{ data: Row[] }>(await getCards(get("/v1/cards?limit=200")));
    expectSchema("CardListResponse", list);
    expect(list.data.length).toBe(CARDS.length);
    for (const card of list.data) {
      expect(card).toMatchObject({ imageUrl: null, imageAlt: null });
      expect(card).not.toHaveProperty("image");
    }

    const one = await ok(await getCard(get("/v1/cards/amex-cobalt"), params("amex-cobalt")));
    expectSchema("CreditCard", one);
    expect(one).toMatchObject({ id: "amex-cobalt", imageUrl: null, imageAlt: null });
  });

  it("GET /v1/merchant-brands(/:id) carry logoUrl/logoAlt = null", async () => {
    const list = await ok<{ data: Row[] }>(
      await getMerchantBrands(get("/v1/merchant-brands?limit=200")),
    );
    expectSchema("MerchantBrandListResponse", list);
    expect(list.data.every((b) => b.logoUrl === null && b.logoAlt === null)).toBe(true);

    const one = await ok(await getMerchantBrand(get("/v1/merchant-brands/shell"), params("shell")));
    expectSchema("MerchantBrand", one);
    expect(one).toMatchObject({ id: "shell", logoUrl: null, logoAlt: null });
  });

  it("GET /v1/loyalty-programs(/:id) carry logoUrl/logoAlt = null", async () => {
    const list = await ok<{ data: Row[] }>(await getLoyaltyPrograms(get("/v1/loyalty-programs")));
    expectSchema("LoyaltyProgramListResponse", list);
    expect(list.data.every((p) => p.logoUrl === null && p.logoAlt === null)).toBe(true);

    const one = await ok(
      await getLoyaltyProgram(get("/v1/loyalty-programs/scene-plus"), params("scene-plus")),
    );
    expectSchema("LoyaltyProgram", one);
    expect(one).toMatchObject({ id: "scene-plus", logoUrl: null, logoAlt: null });
  });

  it("partnership endpoints nest brands[] and loyaltyProgram summaries", async () => {
    const list = await ok<{ data: Array<Row & { brands: Row[] }> }>(
      await getPartnerships(get("/v1/partnerships?limit=200")),
    );
    expectSchema("PartnershipListResponse", list);
    expect(list.data.length).toBe(MERCHANT_PARTNERSHIPS.length);

    const one = await ok(
      await getPartnership(
        get("/v1/partnerships/shell-scene-scotia-scene-cards"),
        params("shell-scene-scotia-scene-cards"),
      ),
    );
    expectSchema("MerchantPartnership", one);
    expect(one.brands).toEqual([{ id: "shell", name: "Shell", logoUrl: null, logoAlt: null }]);
    expect(one.loyaltyProgram).toEqual({
      id: "scene-plus",
      name: "Scene+",
      logoUrl: null,
      logoAlt: null,
    });

    const direct = list.data.find((p) => p.loyaltyProgramId === null)!;
    expect(direct.loyaltyProgram).toBeNull();

    const byBrand = await ok(
      await getBrandPartnerships(get("/v1/merchant-brands/shell/partnerships"), params("shell")),
    );
    expectSchema("PartnershipListResponse", byBrand);
  });

  it("POST /v1/recommendations includes card image, matched brand and program", async () => {
    const body = await ok<{
      purchase: Row;
      recommendations: Array<Row & { card: Row }>;
    }>(await postRecommendations(recommend(SHELL_AT_PUMP)));
    expectSchema("RecommendationResponse", body);

    const shell = { id: "shell", name: "Shell", logoUrl: null, logoAlt: null };
    expect(body.purchase.merchantBrand).toEqual(shell);
    const [top] = body.recommendations;
    expect(top!.card).toMatchObject({ id: "scotia-scene-vi", imageUrl: null, imageAlt: null });
    expect(top!.merchantBrand).toEqual(shell);
    expect(top!.loyaltyProgram).toEqual({
      id: "scene-plus",
      name: "Scene+",
      logoUrl: null,
      logoAlt: null,
    });
  });

  it("POST /v1/recommendations without a merchant has null brand / program", async () => {
    const body = await ok<{ purchase: Row; recommendations: Row[] }>(
      await postRecommendations(
        recommend({ amountCad: 50, category: "dining", ownedCardIds: ["amex-cobalt"] }),
      ),
    );
    expectSchema("RecommendationResponse", body);
    expect(body.purchase.merchantBrand).toBeNull();
    expect(body.recommendations[0]).toMatchObject({ merchantBrand: null, loyaltyProgram: null });
  });
});

// ── Supabase catalog: rows with assets flow through to responses ───────────

const ASSET_BASE = "https://proj.supabase.co/storage/v1/object/public/brand-assets";
const COBALT_URL = `${ASSET_BASE}/cards/amex-cobalt-0123456789ab.webp`;
const SCENE_VI_URL = `${ASSET_BASE}/cards/scotia-scene-vi-0123456789ab.webp`;
const SHELL_URL = `${ASSET_BASE}/merchant-brands/shell-0123456789ab.png`;
const SCENE_URL = `${ASSET_BASE}/loyalty-programs/scene-plus-0123456789ab.png`;

function assetCols(prefix: "image" | "logo", overrides: Row = {}): Row {
  return {
    [`${prefix}_url`]: null,
    [`${prefix}_alt`]: null,
    [`${prefix}_source_url`]: null,
    [`${prefix}_rights_status`]: "placeholder",
    [`${prefix}_updated_at`]: null,
    ...overrides,
  };
}

function cleared(prefix: "image" | "logo", url: string, alt: string, rights = "licensed"): Row {
  return assetCols(prefix, {
    [`${prefix}_url`]: url,
    [`${prefix}_alt`]: alt,
    [`${prefix}_source_url`]: "https://press.example/kit",
    [`${prefix}_rights_status`]: rights,
    [`${prefix}_updated_at`]: "2026-09-27T12:00:00+00:00",
  });
}

function seedTables(): void {
  tables.api_keys = [
    {
      id: "k1",
      key_hash: hashApiKey(TEST_API_KEY),
      owner_label: "contract test",
      tier: "internal",
      rate_limit_per_minute: 600,
      active: true,
    },
  ];
  tables.cards = CARDS.map((c) => ({
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    annual_fee: String(c.annualFee),
    point_currency: c.pointCurrency,
    reward_categories: c.rewardCategories,
    welcome_offer: c.welcomeOffer ?? null,
    network: c.network ?? null,
    tier: c.tier ?? null,
    last_verified: c.lastVerified,
    status: "verified",
    ...(c.id === "amex-cobalt"
      ? cleared("image", COBALT_URL, "American Express Cobalt card")
      : c.id === "scotia-scene-vi"
        ? cleared("image", SCENE_VI_URL, "Scotiabank Scene+ Visa Infinite card", "issuer_provided")
        : c.id === "tangerine-moneyback"
          // Blocked by the DB check constraint; proves the API gate independently.
          ? assetCols("image", {
              image_url: `${ASSET_BASE}/cards/tangerine.png`,
              image_alt: "Tangerine card",
              image_rights_status: "unknown",
            })
          : assetCols("image")),
  }));
  tables.merchant_brands = MERCHANT_BRANDS.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    operator: b.operator ?? null,
    notes: b.notes ?? null,
    source_url: b.sourceUrl,
    last_verified: b.lastVerified,
    status: "verified",
    ...(b.id === "shell"
      ? cleared("logo", SHELL_URL, "Shell logo", "issuer_provided")
      : assetCols("logo")),
  }));
  tables.loyalty_programs = LOYALTY_PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    point_currency: p.pointCurrency ?? null,
    source_url: p.sourceUrl,
    last_verified: p.lastVerified,
    status: "verified",
    ...(p.id === "scene-plus" ? cleared("logo", SCENE_URL, "Scene+ logo") : assetCols("logo")),
  }));
  tables.merchant_partnerships = MERCHANT_PARTNERSHIPS.map((p) => ({
    id: p.id,
    brand_ids: p.merchantBrandIds,
    loyalty_program_id: p.loyaltyProgramId,
    card_ids: p.cardIds,
    affiliation: p.affiliation,
    requirements: p.requirements,
    benefits: p.benefits,
    stacks_with_card_category_rewards: p.stacksWithCardCategoryRewards,
    notes: p.notes ?? null,
    source_urls: p.sourceUrls,
    last_verified: p.lastVerified,
    status: "verified",
  }));
}

describe("contract: supabase catalog (assets populated)", () => {
  const saved = { ...process.env };

  beforeAll(() => {
    seedTables();
    process.env.NORTHTAP_CATALOG_SOURCE = "supabase";
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role-not-a-secret";
    resetCatalogClient();
    resetAuthClient();
  });

  afterAll(() => {
    process.env = saved;
    resetCatalogClient();
    resetAuthClient();
  });

  it("GET /v1/cards serves cleared card art and hides uncleared URLs", async () => {
    const list = await ok<{ data: Row[] }>(await getCards(get("/v1/cards?limit=200")));
    expectSchema("CardListResponse", list);
    const byId = new Map(list.data.map((c) => [c.id, c]));
    expect(byId.get("amex-cobalt")).toMatchObject({
      imageUrl: COBALT_URL,
      imageAlt: "American Express Cobalt card",
    });
    expect(byId.get("tangerine-moneyback")).toMatchObject({ imageUrl: null });
    expect(byId.get("rbc-avion-vi") ?? byId.get("td-aeroplan-vi")).toMatchObject({
      imageUrl: null,
      imageAlt: null,
    });

    const one = await ok(await getCard(get("/v1/cards/amex-cobalt"), params("amex-cobalt")));
    expectSchema("CreditCard", one);
    expect(one.imageUrl).toBe(COBALT_URL);
  });

  it("brand and program endpoints serve logos", async () => {
    const brand = await ok(await getMerchantBrand(get("/v1/merchant-brands/shell"), params("shell")));
    expectSchema("MerchantBrand", brand);
    expect(brand).toMatchObject({ logoUrl: SHELL_URL, logoAlt: "Shell logo" });

    const brands = await ok<{ data: Row[] }>(await getMerchantBrands(get("/v1/merchant-brands?q=shell")));
    expectSchema("MerchantBrandListResponse", brands);

    const program = await ok(
      await getLoyaltyProgram(get("/v1/loyalty-programs/scene-plus"), params("scene-plus")),
    );
    expectSchema("LoyaltyProgram", program);
    expect(program).toMatchObject({ logoUrl: SCENE_URL, logoAlt: "Scene+ logo" });

    const programs = await ok(await getLoyaltyPrograms(get("/v1/loyalty-programs")));
    expectSchema("LoyaltyProgramListResponse", programs);
  });

  it("partnerships nest brand and program logos", async () => {
    const one = await ok(
      await getPartnership(
        get("/v1/partnerships/shell-scene-scotia-scene-cards"),
        params("shell-scene-scotia-scene-cards"),
      ),
    );
    expectSchema("MerchantPartnership", one);
    expect(one.brands).toEqual([
      { id: "shell", name: "Shell", logoUrl: SHELL_URL, logoAlt: "Shell logo" },
    ]);
    expect(one.loyaltyProgram).toEqual({
      id: "scene-plus",
      name: "Scene+",
      logoUrl: SCENE_URL,
      logoAlt: "Scene+ logo",
    });

    const list = await ok(await getPartnerships(get("/v1/partnerships?brandId=shell")));
    expectSchema("PartnershipListResponse", list);
  });

  it("POST /v1/recommendations carries card art, brand logo and program logo", async () => {
    const body = await ok<{
      purchase: Row;
      recommendations: Array<Row & { card: Row }>;
    }>(await postRecommendations(recommend(SHELL_AT_PUMP)));
    expectSchema("RecommendationResponse", body);

    const shell = { id: "shell", name: "Shell", logoUrl: SHELL_URL, logoAlt: "Shell logo" };
    expect(body.purchase.merchantBrand).toEqual(shell);
    const [top] = body.recommendations;
    expect(top!.card).toMatchObject({
      id: "scotia-scene-vi",
      imageUrl: SCENE_VI_URL,
      imageAlt: "Scotiabank Scene+ Visa Infinite card",
    });
    expect(top!.merchantBrand).toEqual(shell);
    expect(top!.loyaltyProgram).toEqual({
      id: "scene-plus",
      name: "Scene+",
      logoUrl: SCENE_URL,
      logoAlt: "Scene+ logo",
    });
  });
});
