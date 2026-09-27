import { describe, expect, it } from "vitest";
import {
  MAX_ASSET_BYTES,
  UsageError,
  buildClearPatch,
  buildUploadPatch,
  objectPathFor,
  parseClearArgs,
  parseUploadArgs,
  sniffContentType,
  storagePathFromPublicUrl,
  validateAssetBytes,
} from "./assets";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

const valid = [
  "card",
  "amex-cobalt",
  "./cobalt.webp",
  "--alt",
  "Amex Cobalt card",
  "--source-url",
  "https://press.example/kit",
  "--rights",
  "issuer_provided",
];

describe("parseUploadArgs", () => {
  it("parses a complete upload command", () => {
    expect(parseUploadArgs([...valid, "--by", "github:octo", "--dry-run"])).toEqual({
      kind: "card",
      id: "amex-cobalt",
      file: "./cobalt.webp",
      alt: "Amex Cobalt card",
      sourceUrl: "https://press.example/kit",
      rights: "issuer_provided",
      by: "github:octo",
      dryRun: true,
    });
  });

  it("defaults --by to the local user", () => {
    expect(parseUploadArgs(valid).by).toMatch(/^local:/);
  });

  it.each([
    ["unknown kind", ["issuer", ...valid.slice(1)]],
    ["bad slug", ["card", "Amex Cobalt", ...valid.slice(2)]],
    ["missing file", valid.filter((a) => a !== "./cobalt.webp")],
    ["svg file", valid.map((a) => (a === "./cobalt.webp" ? "./logo.svg" : a))],
    ["missing alt", valid.filter((a, i) => i !== 3 && i !== 4)],
    ["non-http source", valid.map((a) => (a.startsWith("https://press") ? "ftp://x" : a))],
    ["rights placeholder", valid.map((a) => (a === "issuer_provided" ? "placeholder" : a))],
    ["rights unknown", valid.map((a) => (a === "issuer_provided" ? "unknown" : a))],
  ])("rejects %s", (_label, argv) => {
    expect(() => parseUploadArgs(argv)).toThrow(UsageError);
  });

  it("rejects unknown flags", () => {
    expect(() => parseUploadArgs([...valid, "--force"])).toThrow();
  });
});

describe("parseClearArgs", () => {
  it("parses kind + id", () => {
    expect(parseClearArgs(["loyalty-program", "scene-plus", "--by", "github:octo"])).toEqual({
      kind: "loyalty-program",
      id: "scene-plus",
      by: "github:octo",
      dryRun: false,
    });
  });

  it("rejects extra positionals", () => {
    expect(() => parseClearArgs(["card", "a", "b"])).toThrow(UsageError);
  });
});

describe("file validation", () => {
  it("sniffs PNG, JPEG and WebP", () => {
    expect(sniffContentType(PNG)).toBe("image/png");
    expect(sniffContentType(JPEG)).toBe("image/jpeg");
    expect(sniffContentType(WEBP)).toBe("image/webp");
    expect(sniffContentType(new TextEncoder().encode("<svg/>"))).toBeNull();
  });

  it("requires the bytes to match the extension", () => {
    expect(validateAssetBytes("a.png", PNG)).toBe("image/png");
    expect(validateAssetBytes("a.JPEG", JPEG)).toBe("image/jpeg");
    expect(() => validateAssetBytes("a.png", JPEG)).toThrow(/do not match/);
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateAssetBytes("a.png", new Uint8Array())).toThrow(/empty/);
    const big = new Uint8Array(MAX_ASSET_BYTES + 1);
    big.set(PNG);
    expect(() => validateAssetBytes("a.png", big)).toThrow(/limit/);
  });
});

describe("storage paths", () => {
  it("builds content-addressed paths per kind", () => {
    const a = objectPathFor("merchant-brand", "shell", "Shell.JPEG", JPEG);
    expect(a).toMatch(/^merchant-brands\/shell-[0-9a-f]{12}\.jpg$/);
    expect(objectPathFor("merchant-brand", "shell", "x.jpg", JPEG)).toBe(a);
    expect(objectPathFor("card", "amex-cobalt", "x.png", PNG)).toMatch(
      /^cards\/amex-cobalt-[0-9a-f]{12}\.png$/,
    );
    expect(objectPathFor("loyalty-program", "scene-plus", "x.webp", WEBP)).toMatch(
      /^loyalty-programs\/scene-plus-/,
    );
  });

  it("extracts the bucket path from our public URLs only", () => {
    expect(
      storagePathFromPublicUrl(
        "https://p.supabase.co/storage/v1/object/public/brand-assets/cards/a-1.png?v=1",
      ),
    ).toBe("cards/a-1.png");
    expect(storagePathFromPublicUrl("https://cdn.example.com/cards/a-1.png")).toBeNull();
    expect(storagePathFromPublicUrl(null)).toBeNull();
  });
});

describe("row patches", () => {
  const now = new Date("2026-09-27T12:00:00Z");

  it("sets image_* for cards", () => {
    expect(
      buildUploadPatch(
        { kind: "card", alt: "Alt", sourceUrl: "https://s", rights: "licensed", by: "github:o" },
        "https://u",
        now,
      ),
    ).toEqual({
      image_url: "https://u",
      image_alt: "Alt",
      image_source_url: "https://s",
      image_rights_status: "licensed",
      image_updated_at: "2026-09-27T12:00:00.000Z",
      image_updated_by: "github:o",
    });
  });

  it("clears logo_* back to placeholder", () => {
    expect(buildClearPatch({ kind: "merchant-brand", by: "github:o" }, now)).toEqual({
      logo_url: null,
      logo_alt: null,
      logo_source_url: null,
      logo_rights_status: "placeholder",
      logo_updated_at: "2026-09-27T12:00:00.000Z",
      logo_updated_by: "github:o",
    });
  });
});
