import { describe, expect, it } from "vitest";
import {
  CARDS,
  LOYALTY_PROGRAMS,
  MERCHANT_BRANDS,
  MERCHANT_PARTNERSHIPS,
  type CatalogAsset,
} from "@/domain";
import { mapAsset, mapBrand, mapCard, mapProgram } from "./catalog";
import {
  publicAssetUrl,
  serializeBrand,
  serializeCard,
  serializeLoyaltyProgram,
  serializePartnership,
  summarizeLogo,
} from "./serialize";

const URL_ = "https://proj.supabase.co/storage/v1/object/public/brand-assets/cards/x-abc.webp";

const cardRow = {
  id: "amex-cobalt",
  name: "Cobalt",
  issuer: "American Express",
  annual_fee: "155.4",
  point_currency: "Amex MR",
  reward_categories: [{ category: "dining", earnRate: 5 }],
  welcome_offer: null,
  network: "Amex",
  tier: null,
  last_verified: "2026-09-20",
  status: "verified",
};

function asset(overrides: Partial<CatalogAsset> = {}): CatalogAsset {
  return {
    url: URL_,
    alt: "Alt",
    sourceUrl: "https://press.example",
    rightsStatus: "licensed",
    updatedAt: "2026-09-27T12:00:00.000Z",
    ...overrides,
  };
}

describe("mapAsset", () => {
  it("maps a row with no asset columns set to a null placeholder", () => {
    expect(mapAsset({}, "image")).toEqual({
      url: null,
      alt: null,
      sourceUrl: null,
      rightsStatus: "placeholder",
      updatedAt: null,
    });
  });

  it("maps populated columns by prefix", () => {
    expect(
      mapAsset(
        {
          logo_url: URL_,
          logo_alt: "Shell logo",
          logo_source_url: "https://press.example/kit",
          logo_rights_status: "issuer_provided",
          logo_updated_at: "2026-09-27 12:00:00+00",
          image_url: "https://ignored.example",
        },
        "logo",
      ),
    ).toEqual({
      url: URL_,
      alt: "Shell logo",
      sourceUrl: "https://press.example/kit",
      rightsStatus: "issuer_provided",
      updatedAt: "2026-09-27T12:00:00.000Z",
    });
  });

  it("treats blank strings as null and unrecognised rights as unknown", () => {
    const a = mapAsset(
      { image_url: "  ", image_alt: "", image_rights_status: "scraped" },
      "image",
    );
    expect(a.url).toBeNull();
    expect(a.alt).toBeNull();
    expect(a.rightsStatus).toBe("unknown");
  });
});

describe("row mappers attach assets", () => {
  it("mapCard reads image_* columns", () => {
    const card = mapCard({
      ...cardRow,
      image_url: URL_,
      image_alt: "Cobalt card",
      image_source_url: "https://press.example",
      image_rights_status: "licensed",
    });
    expect(card.annualFee).toBe(155.4);
    expect(card.image).toMatchObject({ url: URL_, alt: "Cobalt card", rightsStatus: "licensed" });
  });

  it("mapBrand and mapProgram read logo_* columns", () => {
    const base = { source_url: "https://s.example", last_verified: "2026-09-20" };
    const brand = mapBrand({ ...base, id: "shell", name: "Shell", category: "gas" });
    const program = mapProgram({
      ...base,
      id: "scene-plus",
      name: "Scene+",
      logo_url: URL_,
      logo_alt: "Scene+ logo",
      logo_source_url: "https://s.example",
      logo_rights_status: "licensed",
    });
    expect(brand.logo?.rightsStatus).toBe("placeholder");
    expect(brand.logo?.url).toBeNull();
    expect(program.logo?.url).toBe(URL_);
  });
});

describe("publicAssetUrl", () => {
  it("returns the URL only for cleared rights", () => {
    expect(publicAssetUrl(asset({ rightsStatus: "licensed" }))).toBe(URL_);
    expect(publicAssetUrl(asset({ rightsStatus: "issuer_provided" }))).toBe(URL_);
    expect(publicAssetUrl(asset({ rightsStatus: "unknown" }))).toBeNull();
    expect(publicAssetUrl(asset({ rightsStatus: "placeholder" }))).toBeNull();
    expect(publicAssetUrl(asset({ url: null }))).toBeNull();
    expect(publicAssetUrl(undefined)).toBeNull();
  });
});

describe("serializers", () => {
  it("static catalog cards serialize with null image fields and no domain `image` key", () => {
    for (const card of CARDS) {
      const out = serializeCard(card);
      expect(out.imageUrl).toBeNull();
      expect(out.imageAlt).toBeNull();
      expect(out).not.toHaveProperty("image");
      expect(out.id).toBe(card.id);
      expect(out.rewardCategories).toEqual(card.rewardCategories);
    }
  });

  it("serializeCard flattens a cleared image and hides an uncleared one", () => {
    const card = CARDS[0]!;
    expect(serializeCard({ ...card, image: asset() })).toMatchObject({
      imageUrl: URL_,
      imageAlt: "Alt",
    });
    expect(
      serializeCard({ ...card, image: asset({ rightsStatus: "unknown" }) }).imageUrl,
    ).toBeNull();
  });

  it("brands and programs expose logoUrl / logoAlt (null in static mode)", () => {
    for (const b of MERCHANT_BRANDS) {
      expect(serializeBrand(b)).toMatchObject({ logoUrl: null, logoAlt: null });
    }
    for (const p of LOYALTY_PROGRAMS) {
      expect(serializeLoyaltyProgram(p)).toMatchObject({ logoUrl: null, logoAlt: null });
    }
    const brand = { ...MERCHANT_BRANDS[0]!, logo: asset({ alt: "Logo" }) };
    expect(summarizeLogo(brand)).toEqual({
      id: brand.id,
      name: brand.name,
      logoUrl: URL_,
      logoAlt: "Logo",
    });
  });

  it("serializePartnership nests verified brands (in order) and the loyalty program", () => {
    const p = MERCHANT_PARTNERSHIPS.find((x) => x.loyaltyProgramId)!;
    const program = LOYALTY_PROGRAMS.find((x) => x.id === p.loyaltyProgramId)!;
    const [firstBrandId] = p.merchantBrandIds;
    const refs = {
      brands: new Map(
        MERCHANT_BRANDS.map((b) => [
          b.id,
          b.id === firstBrandId ? { ...b, logo: asset() } : b,
        ]),
      ),
      programs: new Map([[program.id, program]]),
    };
    const out = serializePartnership(
      { ...p, merchantBrandIds: [...p.merchantBrandIds, "not-a-brand"] },
      refs,
    );
    expect(out.brands.map((b) => b.id)).toEqual(p.merchantBrandIds);
    expect(out.brands[0]!.logoUrl).toBe(URL_);
    expect(out.loyaltyProgram).toEqual({
      id: program.id,
      name: program.name,
      logoUrl: null,
      logoAlt: null,
    });
  });

  it("serializePartnership returns loyaltyProgram null for direct deals", () => {
    const direct = MERCHANT_PARTNERSHIPS.find((x) => x.loyaltyProgramId === null)!;
    const out = serializePartnership(direct, { brands: new Map(), programs: new Map() });
    expect(out.loyaltyProgram).toBeNull();
    expect(out.brands).toEqual([]);
  });
});
