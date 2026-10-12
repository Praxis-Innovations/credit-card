import type { Page, Request } from "@playwright/test";

/** Card fixtures shaped like GET /v1/cards (dev catalog ids, no art). */
export const E2E_CARDS = [
  {
    id: "scotia-gold-amex",
    issuer: "Scotiabank",
    name: "Gold American Express",
    annualFee: 120,
    pointCurrency: "Scene+",
    network: "Amex",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "groceries", earnRate: 5 },
      { category: "gas", earnRate: 1 },
      { category: "other", earnRate: 1 },
    ],
    imageUrl: "http://127.0.0.1:8787/assets/cards/scotia-gold-amex.png",
    imageAlt: "Scotiabank Gold American Express card",
  },
  {
    id: "triangle-we",
    issuer: "Canadian Tire",
    name: "Triangle World Elite Mastercard",
    annualFee: 0,
    pointCurrency: "Triangle",
    network: "Mastercard",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "gas", earnRate: 4 },
      { category: "other", earnRate: 1 },
    ],
    imageUrl: null,
    imageAlt: null,
  },
  {
    id: "cibc-costco-mc",
    issuer: "CIBC",
    name: "Costco Mastercard",
    annualFee: 0,
    pointCurrency: "cashback",
    network: "Mastercard",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "gas", earnRate: 3 },
      { category: "other", earnRate: 1 },
    ],
    // Relative path (served by the API) that 404s: exercises the fallback.
    imageUrl: "/assets/cards/cibc-costco-mc-missing.png",
    imageAlt: null,
  },
  {
    id: "amex-cobalt",
    issuer: "American Express",
    name: "Cobalt",
    annualFee: 155.4,
    pointCurrency: "Amex MR",
    network: "Amex",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "dining", earnRate: 5 },
      { category: "other", earnRate: 1 },
    ],
    imageUrl: null,
    imageAlt: null,
  },
];

const CATEGORIES = [
  { id: "groceries", label: "Groceries" },
  { id: "dining", label: "Dining" },
  { id: "gas", label: "Gas" },
  { id: "drugstore", label: "Drugstore" },
  { id: "travel", label: "Travel" },
  { id: "other", label: "Everything else" },
];

const brand = (id: string, name: string, category: string) => ({
  id,
  name,
  category,
  operator: null,
  notes: null,
  sourceUrl: `https://example.test/${id}`,
  lastVerified: "2026-09-22",
  logoUrl: null,
  logoAlt: null,
});

export const E2E_BRANDS = [
  brand("shell", "Shell", "gas"),
  brand("petro-canada", "Petro-Canada", "gas"),
  brand("esso", "Esso", "gas"),
  brand("ultramar", "Ultramar", "gas"),
  brand("pioneer", "Pioneer", "gas"),
  brand("husky", "Husky", "gas"),
  brand("mobil", "Mobil", "gas"),
  brand("loblaws", "Loblaws", "groceries"),
  brand("shoppers-drug-mart", "Shoppers Drug Mart", "drugstore"),
];

const PROGRAMS = [
  {
    id: "scene-plus",
    name: "Scene+",
    description: null,
    pointCurrency: "Scene+",
    sourceUrl: "https://example.test/scene",
    lastVerified: "2026-09-22",
    logoUrl: null,
    logoAlt: null,
  },
  {
    id: "triangle",
    name: "Triangle Rewards",
    description: null,
    pointCurrency: "Triangle",
    sourceUrl: "https://example.test/triangle",
    lastVerified: "2026-09-22",
    logoUrl: null,
    logoAlt: null,
  },
];

type RecommendationBody = Record<string, unknown> & {
  amountCad: number;
  category: string;
  ownedCardIds?: string[];
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/**
 * Mirrors the API's v1 category ranking for the fixtures: each card earns its
 * rate for the requested category (or its base rate), points worth 1¢. At $100
 * of gas: Triangle $4.00, Costco $3.00, Gold Amex $1.00.
 */
function recommend(body: RecommendationBody) {
  const owned = new Set(body.ownedCardIds ?? []);
  const category = body.category;
  const items = E2E_CARDS.filter((c) => owned.has(c.id)).map((card) => {
    const rate =
      card.rewardCategories.find((r) => r.category === category)?.earnRate ??
      card.rewardCategories.find((r) => r.category === "other")?.earnRate ??
      0;
    const cashback = card.pointCurrency === "cashback";
    const reward = Math.round(body.amountCad * rate) / 100;
    const label = cashback
      ? `${rate}% cash back on ${category}`
      : `${rate}× ${card.pointCurrency} on ${category}`;
    const line: Record<string, unknown> = { label, kind: "card_earn", amountCad: reward };
    if (!cashback) {
      line.points = rate * body.amountCad;
      line.pointCurrency = card.pointCurrency;
      line.centsPerPoint = 1;
    }
    return {
      card,
      earnRate: rate,
      pointValue: 1,
      centsPerDollar: rate,
      estimatedCentsBack: Math.round(reward * 100),
      estimatedRewardCad: reward,
      capExhausted: false,
      reason: label,
      valueBreakdown: [line],
    };
  });
  items.sort((a, b) => b.estimatedRewardCad - a.estimatedRewardCad);
  const recommendations = items.map((item, i) => ({ rank: i + 1, ...item }));
  return {
    purchase: { amountCad: body.amountCad, category },
    recommendations,
    bestCardId: recommendations[0]?.card.id ?? null,
  };
}

/** 1×1 PNG; the card frame, not the file, sets the 1.586:1 shape. */
const CARD_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export interface ApiMock {
  /** Every request that reached the NorthTap API mock. */
  requests: Request[];
  /** Card image paths the app requested. */
  imageRequests: string[];
  recommendationBodies: RecommendationBody[];
  /** When true, API calls fail like a dropped connection. */
  offline: boolean;
}

/** Intercept the NorthTap API so Expo web E2E runs without apps/api. */
export async function installNorthtapApiMock(page: Page): Promise<ApiMock> {
  const mock: ApiMock = {
    requests: [],
    imageRequests: [],
    recommendationBodies: [],
    offline: false,
  };

  await page.route("**/assets/cards/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "8787") return route.fallback();
    mock.imageRequests.push(url.pathname);
    if (url.pathname.endsWith("-missing.png")) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "image/png", body: CARD_PNG });
  });

  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.port !== "8787") return route.fallback();
    mock.requests.push(req);
    if (mock.offline) return route.abort("internetdisconnected");

    const path = url.pathname;
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (!req.headers()["x-api-key"]) {
      return route.fulfill(json({ error: { code: "unauthorized", message: "Missing API key" } }, 401));
    }

    if (path === "/v1/cards" && method === "GET") {
      return route.fulfill(
        json({ data: E2E_CARDS, meta: { total: E2E_CARDS.length, limit: 200, offset: 0 } }),
      );
    }
    if (path === "/v1/categories") return route.fulfill(json({ categories: CATEGORIES }));
    if (path === "/v1/loyalty-programs") return route.fulfill(json({ data: PROGRAMS }));
    if (path === "/v1/merchant-brands") {
      const category = url.searchParams.get("category");
      const data = category ? E2E_BRANDS.filter((b) => b.category === category) : E2E_BRANDS;
      return route.fulfill(json({ data, meta: { total: data.length, limit: 200, offset: 0 } }));
    }
    if (path === "/v1/recommendations" && method === "POST") {
      const body = req.postDataJSON() as RecommendationBody;
      mock.recommendationBodies.push(body);
      return route.fulfill(json(recommend(body)));
    }
    return route.fulfill(
      json({ error: { code: "not_found", message: `Unhandled mock path ${path}` } }, 404),
    );
  });

  return mock;
}

/** Overpass fixture: what the OSM lookup returns around the test location. */
export async function installOverpassMock(page: Page) {
  const bodies: string[] = [];
  await page.route("**/api/interpreter", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill(
      json({
        elements: [
          {
            type: "node",
            id: 1,
            lat: 43.6631,
            lon: -79.3959,
            tags: { amenity: "fuel", brand: "Shell", name: "Shell" },
          },
          {
            type: "node",
            id: 2,
            lat: 43.6640,
            lon: -79.3950,
            tags: { amenity: "pharmacy", brand: "Shoppers Drug Mart", name: "Shoppers Drug Mart" },
          },
          {
            type: "node",
            id: 3,
            lat: 43.6650,
            lon: -79.3970,
            tags: { shop: "convenience", name: "Harbord Convenience" },
          },
        ],
      }),
    );
  });
  return { bodies };
}
