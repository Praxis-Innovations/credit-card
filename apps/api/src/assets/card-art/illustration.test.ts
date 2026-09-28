import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CARDS, ISSUERS, type CreditCard } from "@/domain";
import { MAX_ASSET_BYTES, sniffContentType } from "../assets";
import {
  ILLUSTRATION_HEIGHT,
  ILLUSTRATION_WIDTH,
  ISSUER_TONES,
  OUTPUT_WIDTH,
  escapeXml,
  illustrationAlt,
  rasterizeSvg,
  renderIllustrationSvg,
  toneForIssuer,
  wrapWords,
} from "./illustration";

/** ID-1 cards are 85.60 × 53.98 mm. */
const CARD_ASPECT = 85.6 / 53.98;

describe("renderIllustrationSvg", () => {
  const cobalt = CARDS.find((c) => c.id === "amex-cobalt")!;

  it("is card-shaped and shows issuer, card name, network, a chip and an Illustration label", () => {
    const svg = renderIllustrationSvg(cobalt);
    expect(Math.abs(ILLUSTRATION_WIDTH / ILLUSTRATION_HEIGHT - CARD_ASPECT)).toBeLessThan(0.01);
    expect(svg).toContain(`width="${ILLUSTRATION_WIDTH}" height="${ILLUSTRATION_HEIGHT}"`);
    expect(svg).toContain(">American Express</text>");
    expect(svg).toContain(">Cobalt</tspan>");
    expect(svg).toContain(">AMEX</text>");
    expect(svg).toContain(">ILLUSTRATION</text>");
    expect(svg).toMatch(/<rect x="60" y="176" width="112" height="86"/);
  });

  it("carries no card number, logos, external references or script", () => {
    for (const card of CARDS) {
      const svg = renderIllustrationSvg(card);
      expect(svg).not.toMatch(/<image|<script|href=|xlink|on\w+=|\d{4}\s?\d{4}/i);
    }
  });

  it("escapes names and wraps long names onto at most two lines", () => {
    const svg = renderIllustrationSvg({
      issuer: "A&B <Bank>" as CreditCard["issuer"],
      name: "Cash Back Preferred World Elite Mastercard",
      network: "Mastercard",
    });
    expect(svg).toContain("A&amp;B &lt;Bank&gt;");
    expect(svg.match(/<tspan /g)).toHaveLength(2);
    expect(escapeXml(`"'`)).toBe("&quot;&apos;");
    expect(wrapWords("one two three", 7)).toEqual(["one two", "three"]);
  });

  it("uses a fixed tone per issuer and covers every catalog issuer", () => {
    for (const issuer of ISSUERS) expect(ISSUER_TONES[issuer]).toMatch(/^#[0-9a-f]{6}$/);
    expect(toneForIssuer("TD")).toBe(ISSUER_TONES.TD);
    expect(toneForIssuer("Unknown Bank")).toBe(toneForIssuer("Unknown Bank"));
  });

  it("is deterministic, so re-runs produce the same bytes and object path", async () => {
    const card = CARDS[0]!;
    expect(renderIllustrationSvg(card)).toBe(renderIllustrationSvg(card));
    const [a, b] = await Promise.all([
      rasterizeSvg(renderIllustrationSvg(card)),
      rasterizeSvg(renderIllustrationSvg(card)),
    ]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("describes itself as an illustration in alt text", () => {
    expect(illustrationAlt(cobalt)).toBe("American Express Cobalt card (illustration)");
  });
});

describe("rasterizeSvg", () => {
  it("produces an uploadable, card-shaped PNG", async () => {
    const card = CARDS.find((c) => c.id === "rbc-cashback-preferred")!;
    const png = await rasterizeSvg(renderIllustrationSvg(card));
    expect(sniffContentType(png)).toBe("image/png");
    expect(png.length).toBeLessThan(MAX_ASSET_BYTES);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(OUTPUT_WIDTH);
    expect(Math.abs(meta.width! / meta.height! - CARD_ASPECT)).toBeLessThan(0.01);
  });
});
