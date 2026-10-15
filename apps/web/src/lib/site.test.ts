import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, absoluteUrl, resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("defaults to the production Vercel URL", () => {
    expect(DEFAULT_SITE_URL).toBe("https://northtap.vercel.app");
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("  ")).toBe(DEFAULT_SITE_URL);
  });

  it("uses SITE_URL, normalized to an origin", () => {
    expect(resolveSiteUrl("https://northtap.ca/")).toBe("https://northtap.ca");
    expect(resolveSiteUrl("https://preview.example.com/some/path")).toBe(
      "https://preview.example.com",
    );
  });

  it("falls back to the default for an invalid value", () => {
    expect(resolveSiteUrl("not a url")).toBe(DEFAULT_SITE_URL);
  });
});

describe("absoluteUrl", () => {
  it("joins paths onto the site URL, with the home page as the bare origin", () => {
    expect(absoluteUrl("/", "https://x.test")).toBe("https://x.test");
    expect(absoluteUrl("/gas", "https://x.test")).toBe("https://x.test/gas");
  });
});
