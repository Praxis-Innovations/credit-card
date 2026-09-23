import type { Page } from "@playwright/test";

/** Minimal catalog for Expo web E2E — enough cards for search + ranking. */
const E2E_CARDS = [
  {
    id: "amex-cobalt",
    issuer: "American Express",
    name: "Cobalt",
    annualFee: 155.4,
    pointCurrency: "Amex MR",
    network: "Amex",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "groceries", earnRate: 5, capMonthly: 2500 },
      { category: "dining", earnRate: 5, capMonthly: 2500 },
      { category: "other", earnRate: 1 },
    ],
  },
  {
    id: "tangerine-moneyback",
    issuer: "Tangerine",
    name: "Money-Back Mastercard",
    annualFee: 0,
    pointCurrency: "cashback",
    network: "Mastercard",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "groceries", earnRate: 2 },
      { category: "dining", earnRate: 2 },
      { category: "other", earnRate: 0.5 },
    ],
  },
  {
    id: "scotia-scene-vi",
    issuer: "Scotiabank",
    name: "Scene+ Visa Infinite",
    annualFee: 120,
    pointCurrency: "Scene+",
    network: "Visa",
    lastVerified: "2026-09-20",
    rewardCategories: [
      { category: "groceries", earnRate: 2 },
      { category: "gas", earnRate: 1 },
      { category: "other", earnRate: 1 },
    ],
  },
];

const POINT_VALUES: Record<string, number> = {
  "Amex MR": 2.4,
  cashback: 1,
  "Scene+": 1,
};

/**
 * Intercept NorthTap API so Expo web E2E works without a live apps/api process.
 */
export async function installNorthtapApiMock(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path.endsWith("/health") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    }

    const apiKey =
      req.headers()["x-api-key"] ||
      req.headers()["authorization"]?.replace(/^Bearer\s+/i, "");
    if (!apiKey) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "unauthorized", message: "Missing API key" },
        }),
      });
    }

    if (path.includes("/cards") && method === "GET" && !/\/cards\/[^/]+$/.test(path)) {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      let data = E2E_CARDS;
      if (q) {
        data = data.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.issuer.toLowerCase().includes(q) ||
            c.id.includes(q),
        );
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data,
          meta: { total: data.length, limit: 200, offset: 0 },
        }),
      });
    }

    if (path.endsWith("/recommendations") && method === "POST") {
      const body = req.postDataJSON() as {
        amountCad: number;
        category: string;
        merchant?: string;
        ownedCardIds?: string[];
        merchantQuery?: string;
      };
      const owned = new Set(body.ownedCardIds ?? []);
      const ranked = E2E_CARDS.filter((c) => owned.has(c.id))
        .map((card) => {
          const reward =
            card.rewardCategories.find((r) => r.category === body.category) ??
            card.rewardCategories.find((r) => r.category === "other");
          const earnRate = reward?.earnRate ?? 0;
          const pointValue = POINT_VALUES[card.pointCurrency] ?? 1;
          const centsPerDollar = earnRate * pointValue;
          return { card, earnRate, pointValue, centsPerDollar };
        })
        .sort((a, b) => b.centsPerDollar - a.centsPerDollar);

      const recommendations = ranked.map((rec, index) => {
        const estimatedCentsBack = body.amountCad * rec.centsPerDollar;
        const estimatedRewardCad = estimatedCentsBack / 100;
        const label = body.category;
        const where = body.merchant ?? body.merchantQuery ?? label;
        const reason =
          index === 0
            ? `${rec.card.name} gives ${rec.earnRate}${rec.card.pointCurrency === "cashback" ? "%" : "×"} ${rec.card.pointCurrency === "cashback" ? "cash back" : rec.card.pointCurrency} on ${label} — best for this $${body.amountCad.toFixed(2)} purchase at ${where} (~$${estimatedRewardCad.toFixed(2)} back)`
            : `${rec.earnRate}× — ~$${estimatedRewardCad.toFixed(2)} back on this $${body.amountCad.toFixed(2)} purchase`;
        return {
          rank: index + 1,
          card: rec.card,
          earnRate: rec.earnRate,
          pointValue: rec.pointValue,
          centsPerDollar: rec.centsPerDollar,
          estimatedCentsBack,
          estimatedRewardCad,
          capExhausted: false,
          reason,
          usedPartnership: false,
        };
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          purchase: {
            amountCad: body.amountCad,
            category: body.category,
            merchant: body.merchant ?? null,
            merchantQuery: body.merchantQuery ?? null,
            merchantBrandId: null,
          },
          recommendations,
          bestCardId: recommendations[0]?.card.id ?? null,
        }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "not_found", message: `Unhandled mock path ${path}` },
      }),
    });
  });
}
