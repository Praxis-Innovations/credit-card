import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStaticApiKeys,
  registerStaticApiKey,
} from "../lib/auth";
import { resetRateLimits } from "../lib/rate-limit";
import { GET as getHealth } from "../app/v1/health/route";
import { GET as getCards } from "../app/v1/cards/route";
import { GET as getCard } from "../app/v1/cards/[id]/route";
import { GET as getIssuers } from "../app/v1/issuers/route";
import { GET as getCategories } from "../app/v1/categories/route";
import { GET as getLoyaltyPrograms } from "../app/v1/loyalty-programs/route";
import { GET as getLoyaltyProgram } from "../app/v1/loyalty-programs/[id]/route";
import { GET as getMerchantBrands } from "../app/v1/merchant-brands/route";
import { GET as getMerchantBrand } from "../app/v1/merchant-brands/[id]/route";
import { GET as getBrandPartnerships } from "../app/v1/merchant-brands/[id]/partnerships/route";
import { GET as getPartnerships } from "../app/v1/partnerships/route";
import { GET as getPartnership } from "../app/v1/partnerships/[id]/route";
import { POST as postRecommendations } from "../app/v1/recommendations/route";

process.env.NORTHTAP_CATALOG_SOURCE = "static";

/** Throwaway key for unit tests — not a real credential. */
const TEST_API_KEY = "test-api-key-not-a-production-secret";

function authHeaders(key = TEST_API_KEY): HeadersInit {
  return { "X-Api-Key": key };
}

function req(
  path: string,
  init: RequestInit = {},
): Request {
  return new Request(`http://localhost:8787${path}`, init);
}

async function jsonOf(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(() => {
  resetRateLimits();
  clearStaticApiKeys();
  registerStaticApiKey(TEST_API_KEY);
});

describe("GET /v1/health", () => {
  it("returns ok without auth", async () => {
    const res = await getHealth(req("/v1/health"));
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("auth", () => {
  it("rejects missing API key", async () => {
    const res = await getCards(req("/v1/cards"));
    expect(res.status).toBe(401);
    const body = (await jsonOf(res)) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects invalid API key", async () => {
    const res = await getCards(
      req("/v1/cards", { headers: authHeaders("nt_live_bogus") }),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /v1/cards", () => {
  it("lists cards with pagination", async () => {
    const res = await getCards(
      req("/v1/cards?limit=5&offset=0", { headers: authHeaders() }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      data: unknown[];
      meta: { total: number; limit: number; offset: number };
    };
    expect(body.data.length).toBe(5);
    expect(body.meta.total).toBeGreaterThan(5);
    expect(body.meta.limit).toBe(5);
  });

  it("filters by issuer", async () => {
    const res = await getCards(
      req("/v1/cards?issuer=American%20Express&limit=50", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      data: Array<{ issuer: string }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((c) => c.issuer === "American Express")).toBe(
      true,
    );
  });

  it("returns 404 for unknown card", async () => {
    const res = await getCard(
      req("/v1/cards/not-a-card", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "not-a-card" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns a single card", async () => {
    const res = await getCard(
      req("/v1/cards/amex-cobalt", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "amex-cobalt" }) },
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { id: string; name: string };
    expect(body.id).toBe("amex-cobalt");
    expect(body.name).toBe("Cobalt");
  });
});

describe("GET /v1/issuers + /v1/categories", () => {
  it("lists issuers", async () => {
    const res = await getIssuers(
      req("/v1/issuers", { headers: authHeaders() }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { issuers: string[] };
    expect(body.issuers).toContain("Scotiabank");
  });

  it("lists categories", async () => {
    const res = await getCategories(
      req("/v1/categories", { headers: authHeaders() }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      categories: Array<{ id: string; label: string }>;
    };
    expect(body.categories.some((c) => c.id === "groceries")).toBe(true);
  });
});

describe("loyalty programs", () => {
  it("lists programs", async () => {
    const res = await getLoyaltyPrograms(
      req("/v1/loyalty-programs", { headers: authHeaders() }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { data: Array<{ id: string }> };
    expect(body.data.some((p) => p.id === "scene-plus")).toBe(true);
  });

  it("returns 404 for unknown program", async () => {
    const res = await getLoyaltyProgram(
      req("/v1/loyalty-programs/nope", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns a program by id", async () => {
    const res = await getLoyaltyProgram(
      req("/v1/loyalty-programs/scene-plus", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "scene-plus" }) },
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { id: string; name: string };
    expect(body.id).toBe("scene-plus");
  });
});

describe("merchant brands + partnerships", () => {
  it("searches brands by name", async () => {
    const res = await getMerchantBrands(
      req("/v1/merchant-brands?q=shell&limit=10", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      data: Array<{ id: string }>;
    };
    expect(body.data.some((b) => b.id === "shell")).toBe(true);
  });

  it("returns 404 for unknown brand", async () => {
    const res = await getMerchantBrand(
      req("/v1/merchant-brands/nope", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("lists partnerships for a brand", async () => {
    const res = await getBrandPartnerships(
      req("/v1/merchant-brands/shell/partnerships", {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: "shell" }) },
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      data: Array<{ id: string; brandIds: string[] }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every((p) => p.brandIds.includes("shell")),
    ).toBe(true);
  });

  it("filters partnerships by cardId", async () => {
    const res = await getPartnerships(
      req("/v1/partnerships?cardId=scotia-scene-vi&limit=50", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      data: Array<{ cardIds: string[] }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every((p) => p.cardIds.includes("scotia-scene-vi")),
    ).toBe(true);
  });

  it("returns 404 for unknown partnership", async () => {
    const res = await getPartnership(
      req("/v1/partnerships/nope", { headers: authHeaders() }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns a partnership by id", async () => {
    const res = await getPartnership(
      req("/v1/partnerships/shell-scene-scotia-scene-cards", {
        headers: authHeaders(),
      }),
      {
        params: Promise.resolve({
          id: "shell-scene-scotia-scene-cards",
        }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { id: string };
    expect(body.id).toBe("shell-scene-scotia-scene-cards");
  });
});

describe("POST /v1/recommendations", () => {
  it("ranks owned cards", async () => {
    const res = await postRecommendations(
      req("/v1/recommendations", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCad: 100,
          category: "dining",
          ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      bestCardId: string;
      recommendations: Array<{ rank: number }>;
    };
    expect(body.bestCardId).toBe("amex-cobalt");
    expect(body.recommendations[0]?.rank).toBe(1);
  });

  it("uses partnership-aware ranking via merchantQuery", async () => {
    const res = await postRecommendations(
      req("/v1/recommendations", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCad: 60,
          category: "gas",
          merchantQuery: "Shell",
          ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      bestCardId: string;
      purchase: {
        merchantBrandId: string | null;
        merchantQuery: string;
        fuelGrade: string | null;
      };
      recommendations: Array<{ usedPartnership?: boolean }>;
    };
    expect(body.purchase.merchantQuery).toBe("Shell");
    expect(body.purchase.merchantBrandId).toBe("shell");
    expect(body.purchase.fuelGrade).toBe("regular");
    // Regular fuel: 2% cash back + 3¢/L beats 1× Scene+ + 3¢/L + 1 Scene+/L.
    expect(body.bestCardId).toBe("tangerine-moneyback");
    expect(body.recommendations.every((r) => r.usedPartnership)).toBe(true);
  });

  describe("fuel grade + value breakdown", () => {
    type BreakdownItem = {
      label: string;
      kind: string;
      amountCad: number;
      promotional?: boolean;
      promotionalEnds?: string | null;
    };
    type Body = {
      bestCardId: string;
      purchase: { fuelGrade: string | null };
      recommendations: Array<{
        card: { id: string };
        estimatedRewardCad: number;
        valueBreakdown: BreakdownItem[];
        assumptions: {
          cadPerLitre: number | null;
          litres: number | null;
          pointValuations: Record<string, number>;
        };
      }>;
    };

    async function recommend(extra: Record<string, unknown>) {
      const res = await postRecommendations(
        req("/v1/recommendations", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCad: 100,
            category: "gas",
            merchantQuery: "Shell",
            ownedCardIds: ["scotia-gold-amex", "triangle-we"],
            ...extra,
          }),
        }),
      );
      return { status: res.status, body: (await jsonOf(res)) as Body };
    }

    const summary = (body: Body) =>
      body.recommendations.map((r) => [r.card.id, r.estimatedRewardCad]);
    const toCents = (cad: number) => Math.round(cad * 100);

    it("defaults to regular: Triangle World Elite beats Gold Amex at Shell", async () => {
      const { status, body } = await recommend({});
      expect(status).toBe(200);
      expect(body.purchase.fuelGrade).toBe("regular");
      expect(summary(body)).toEqual([
        ["triangle-we", 4],
        ["scotia-gold-amex", 3.67],
      ]);
      const gold = body.recommendations[1]!;
      expect(gold.valueBreakdown.map((i) => [i.kind, i.amountCad])).toEqual([
        ["card_earn", 1],
        ["cents_per_litre_instant", 2],
        ["points_per_litre", 0.67],
      ]);
      expect(gold.assumptions).toEqual({
        cadPerLitre: 1.5,
        litres: 66.67,
        pointValuations: { "Scene+": 1 },
      });
    });

    it("premium unlocks V-Power benefits and flips the ranking", async () => {
      const { body } = await recommend({ fuelGrade: "premium" });
      expect(body.purchase.fuelGrade).toBe("premium");
      expect(summary(body)).toEqual([
        ["scotia-gold-amex", 7],
        ["triangle-we", 4],
      ]);
      const promo = body.recommendations[0]!.valueBreakdown.filter(
        (i) => i.promotional,
      );
      expect(promo).toEqual([
        expect.objectContaining({
          kind: "cents_per_litre_instant",
          amountCad: 2.67,
          promotionalEnds: "2027-06-01",
        }),
      ]);
    });

    it("breakdown sums exactly to estimatedRewardCad", async () => {
      for (const fuelGrade of ["regular", "premium"]) {
        for (const amountCad of [100, 47.29, 13.37]) {
          const { body } = await recommend({ fuelGrade, amountCad });
          for (const rec of body.recommendations) {
            expect(rec.valueBreakdown.length).toBeGreaterThan(0);
            expect(
              rec.valueBreakdown.reduce((s, i) => s + toCents(i.amountCad), 0),
            ).toBe(toCents(rec.estimatedRewardCad));
          }
        }
      }
    });

    it("leaves non-fuel merchants unaffected", async () => {
      const base = {
        amountCad: 80,
        category: "groceries",
        merchantQuery: "Loblaws",
        ownedCardIds: ["pc-financial-we", "scotia-gold-amex", "amex-cobalt"],
      };
      const regular = await recommend(base);
      const premium = await recommend({ ...base, fuelGrade: "premium" });
      expect(regular.status).toBe(200);
      expect(regular.body.purchase.fuelGrade).toBeNull();
      expect(premium.body).toEqual(regular.body);
      for (const rec of regular.body.recommendations) {
        expect(rec.assumptions.cadPerLitre).toBeNull();
        expect(
          rec.valueBreakdown.reduce((s, i) => s + toCents(i.amountCad), 0),
        ).toBe(toCents(rec.estimatedRewardCad));
      }
    });

    it("rejects an unknown fuelGrade", async () => {
      const { status } = await recommend({ fuelGrade: "diesel" });
      expect(status).toBe(400);
    });
  });

  it("returns 422 for empty wallet", async () => {
    const res = await postRecommendations(
      req("/v1/recommendations", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCad: 50,
          category: "dining",
          ownedCardIds: [],
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated recommendations", async () => {
    const res = await postRecommendations(
      req("/v1/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCad: 50,
          category: "dining",
          ownedCardIds: ["amex-cobalt"],
        }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
