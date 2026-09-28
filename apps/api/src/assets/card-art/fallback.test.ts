import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CARDS, ISSUERS, type CreditCard } from "@/domain";
import { MAX_ASSET_BYTES, sniffContentType } from "../assets";
import {
  FALLBACK_HEIGHT,
  FALLBACK_WIDTH,
  ISSUER_TONES,
  escapeXml,
  fallbackAlt,
  renderFallbackSvg,
  toneForIssuer,
  wrapWords,
} from "./fallback";
import { normalizeCardArt, rasterizeSvg } from "./image";
import { CARD_ASPECT, checkCardShape } from "./select";

describe("renderFallbackSvg", () => {
  const cobalt = CARDS.find((c) => c.id === "amex-cobalt")!;

  it("is card-shaped and shows issuer, card name, network, a chip and an Illustration label", () => {
    const svg = renderFallbackSvg(cobalt);
    expect(Math.abs(FALLBACK_WIDTH / FALLBACK_HEIGHT - CARD_ASPECT)).toBeLessThan(0.01);
    expect(svg).toContain(`width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}"`);
    expect(svg).toContain(">American Express</text>");
    expect(svg).toContain(">Cobalt</tspan>");
    expect(svg).toContain(">AMEX</text>");
    expect(svg).toContain(">ILLUSTRATION</text>");
    expect(svg).toMatch(/<rect x="60" y="176" width="112" height="86"/);
  });

  it("carries no card number, logos, external references or script", () => {
    for (const card of CARDS) {
      const svg = renderFallbackSvg(card);
      expect(svg).not.toMatch(/<image|<script|href=|xlink|on\w+=|\d{4}\s?\d{4}/i);
    }
  });

  it("escapes names and wraps long names onto at most two lines", () => {
    const svg = renderFallbackSvg({
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
    const td = CARDS.filter((c) => c.issuer === "TD").map((c) => renderFallbackSvg(c));
    for (const svg of td) expect(svg).toContain("#");
  });

  it("describes itself as an illustration in alt text", () => {
    expect(fallbackAlt(cobalt)).toBe("American Express Cobalt card (illustration)");
  });
});

describe("rasterizeSvg", () => {
  it("produces an uploadable, card-shaped PNG", async () => {
    const card = CARDS.find((c) => c.id === "rbc-cashback-preferred")!;
    const png = await rasterizeSvg(renderFallbackSvg(card));
    expect(sniffContentType(png)).toBe("image/png");
    expect(png.length).toBeLessThan(MAX_ASSET_BYTES);
    const meta = await sharp(png).metadata();
    expect(checkCardShape({ width: meta.width!, height: meta.height! }).ok).toBe(true);
    expect(meta.width).toBe(640);
  });
});

describe("normalizeCardArt", () => {
  it("trims transparent margins around card art and re-encodes to 640px PNG", async () => {
    const art = await sharp({
      create: { width: 856, height: 540, channels: 4, background: "#335577" },
    })
      .png()
      .toBuffer();
    const padded = await sharp(art)
      .extend({ top: 200, bottom: 200, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const out = await normalizeCardArt(new Uint8Array(padded));
    expect(out).toMatchObject({ ok: true, width: 640, source: { trimmed: true } });
  });

  it("crops a soft drop shadow down to the opaque card", async () => {
    const art = await sharp({
      create: { width: 856, height: 540, channels: 4, background: "#335577" },
    })
      .png()
      .toBuffer();
    const shadow = await sharp({
      create: { width: 856, height: 540, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.35 } },
    })
      .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .blur(20)
      .png()
      .toBuffer();
    const withShadow = await sharp(shadow)
      .composite([{ input: art, top: 50, left: 60 }])
      .png()
      .toBuffer();
    const out = await normalizeCardArt(new Uint8Array(withShadow));
    expect(out).toMatchObject({ ok: true, width: 640, cardEdges: true, source: { trimmed: true } });
    if (out.ok) expect(out.height).toBe(Math.round((640 * 540) / 856));
  });

  it("turns vertical card art to landscape", async () => {
    const portrait = await sharp({
      create: { width: 610, height: 960, channels: 3, background: "#224466" },
    })
      .png()
      .toBuffer();
    const out = await normalizeCardArt(new Uint8Array(portrait));
    expect(out).toMatchObject({ ok: true, width: 640, source: { rotated: true } });
    if (out.ok) expect(out.height).toBe(Math.round((640 * 610) / 960));
  });

  it("rejects a banner and non-image bytes", async () => {
    const banner = await sharp({
      create: { width: 1200, height: 630, channels: 3, background: "#aa3322" },
    })
      .jpeg()
      .toBuffer();
    expect(await normalizeCardArt(new Uint8Array(banner))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not card-shaped/),
    });
    expect(await normalizeCardArt(new TextEncoder().encode("<svg/>"))).toMatchObject({
      ok: false,
    });
  });
});
