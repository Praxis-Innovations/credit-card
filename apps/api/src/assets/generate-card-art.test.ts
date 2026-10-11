import { describe, expect, it } from "vitest";
import { CARDS } from "@/domain";
import { rasterizeSvg, renderIllustrationSvg } from "./card-art/illustration";
import { illustrationPath, planCard, type CardImageRow } from "./generate-card-art";

const BASE = "https://proj.supabase.co/storage/v1/object/public/brand-assets";
const card = CARDS.find((c) => c.id === "amex-cobalt")!;
const target = {
  path: "cards/generated/amex-cobalt-0123456789ab.png",
  url: `${BASE}/cards/generated/amex-cobalt-0123456789ab.png`,
};

function row(overrides: Partial<CardImageRow> = {}): CardImageRow {
  return {
    id: card.id,
    issuer: card.issuer,
    name: card.name,
    network: card.network,
    image_url: null,
    image_alt: null,
    image_source_url: null,
    image_rights_status: "placeholder",
    ...overrides,
  };
}

describe("planCard", () => {
  it("points a placeholder card at its illustration with rights generated", () => {
    expect(planCard(row(), target)).toEqual({
      action: "update",
      patch: {
        image_url: target.url,
        image_alt: "American Express Cobalt card (illustration)",
        image_source_url: null,
        image_rights_status: "generated",
      },
      previousPath: null,
    });
  });

  it("leaves an up-to-date row alone (idempotent re-run)", () => {
    const current = row({
      image_url: target.url,
      image_alt: "American Express Cobalt card (illustration)",
      image_rights_status: "generated",
    });
    expect(planCard(current, target)).toEqual({ action: "unchanged" });
  });

  it("replaces an older illustration or unknown-provenance art and deletes the old object", () => {
    const older = row({
      image_url: `${BASE}/cards/generated/amex-cobalt-ffffffffffff.png`,
      image_alt: "American Express Cobalt card (illustration)",
      image_rights_status: "generated",
    });
    expect(planCard(older, target)).toMatchObject({
      action: "update",
      previousPath: "cards/generated/amex-cobalt-ffffffffffff.png",
    });
    const unknown = row({
      image_url: `${BASE}/cards/amex-cobalt-38beec27256f.png`,
      image_alt: "American Express Cobalt card",
      image_source_url: "https://issuer.example/cobalt",
      image_rights_status: "unknown",
    });
    expect(planCard(unknown, target)).toMatchObject({
      action: "update",
      patch: { image_source_url: null, image_rights_status: "generated" },
      previousPath: "cards/amex-cobalt-38beec27256f.png",
    });
  });

  it("never touches licensed or issuer_provided art", () => {
    for (const rights of ["licensed", "issuer_provided"]) {
      const cleared = row({
        image_url: `${BASE}/cards/amex-cobalt-aaaaaaaaaaaa.webp`,
        image_alt: "American Express Cobalt card",
        image_source_url: "https://press.example/kit",
        image_rights_status: rights,
      });
      expect(planCard(cleared, target)).toEqual({ action: "skip", reason: `has ${rights} art` });
    }
  });
});

describe("illustrationPath", () => {
  it("is a content-hashed PNG under cards/generated/, stable across renders", async () => {
    const png = await rasterizeSvg(renderIllustrationSvg(card));
    const path = illustrationPath(row(), png);
    expect(path).toMatch(/^cards\/generated\/amex-cobalt-[0-9a-f]{12}\.png$/);
    expect(illustrationPath(row(), await rasterizeSvg(renderIllustrationSvg(card)))).toBe(path);
  });
});
