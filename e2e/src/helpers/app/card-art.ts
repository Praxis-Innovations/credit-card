import type { Page } from "@playwright/test";
import { urls } from "../../env";

/** 1×1 PNG; the card frame, not the file, sets the 1.586:1 shape. */
const CARD_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function isNorthtapApi(url: string): boolean {
  return url.startsWith(urls.api.replace(/\/$/, ""));
}

/** Paths the app will request for cards we inject imageUrl onto. */
export const CARD_ART = {
  scotia: {
    path: "/assets/cards/e2e-scotia-gold-amex.png",
    alt: "Scotiabank Gold American Express card (illustration)",
  },
  costco: {
    path: "/assets/cards/e2e-cibc-costco-mc-missing.png",
  },
} as const;

type JsonCard = {
  id?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  card?: JsonCard;
};

function patchCard(card: JsonCard | undefined): void {
  if (!card?.id) return;
  if (card.id === "scotia-gold-amex") {
    card.imageUrl = CARD_ART.scotia.path;
    card.imageAlt = CARD_ART.scotia.alt;
  } else if (card.id === "cibc-costco-mc") {
    card.imageUrl = CARD_ART.costco.path;
    card.imageAlt = null;
  } else if (card.id === "triangle-we") {
    card.imageUrl = null;
    card.imageAlt = null;
  }
}

function patchPayload(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const obj = body as Record<string, unknown>;

  if (Array.isArray(obj.data)) {
    for (const row of obj.data) patchCard(row as JsonCard);
  }
  if (Array.isArray(obj.recommendations)) {
    for (const row of obj.recommendations) {
      patchCard((row as JsonCard).card);
    }
  }
  return body;
}

/**
 * Static catalog serves null imageUrl. For card-art E2E we rewrite API JSON so
 * Scotia has a working image and Costco points at a URL we abort — then assert
 * real art vs tinted fallback against the local stack.
 */
export async function installCardArtFixtures(page: Page) {
  const imageRequests: string[] = [];

  await page.route(
    (url) => isNorthtapApi(url.href) && url.pathname.startsWith("/assets/cards/"),
    async (route) => {
      const url = new URL(route.request().url());
      imageRequests.push(url.pathname);
      if (url.pathname.includes("missing")) {
        return route.fulfill({ status: 404, body: "" });
      }
      return route.fulfill({ status: 200, contentType: "image/png", body: CARD_PNG });
    },
  );

  // Only the NorthTap API origin — never Supabase /rest/v1 or /auth/v1.
  await page.route(
    (url) => isNorthtapApi(url.href) && url.pathname.startsWith("/v1/"),
    async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fallback();

      const response = await route.fetch();
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        return route.fulfill({ response });
      }
      const raw = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return route.fulfill({ response, body: raw });
      }
      const patched = JSON.stringify(patchPayload(parsed));
      return route.fulfill({
        status: response.status(),
        headers: { ...response.headers(), "content-type": "application/json" },
        body: patched,
      });
    },
  );
  return { imageRequests };
}
