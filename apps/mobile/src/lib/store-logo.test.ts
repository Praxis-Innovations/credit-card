import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./api-types";
import { resolveAssetUrl } from "./api-client";
import { CATEGORY_ICON_IDS, storeLogoMode } from "./store-logo";

describe("storeLogoMode", () => {
  it("uses the brand logo when a catalog URL is present (match)", () => {
    expect(storeLogoMode("/assets/brands/shell.png")).toBe("logo");
    expect(storeLogoMode("https://cdn.example/shell.png")).toBe("logo");
  });

  it("falls back to the category icon when there is no logo", () => {
    expect(storeLogoMode(null)).toBe("category");
    expect(storeLogoMode(undefined)).toBe("category");
    expect(storeLogoMode("")).toBe("category");
    expect(storeLogoMode("   ")).toBe("category");
  });

  it("falls back to the category icon when the logo fails to load", () => {
    const path = "/assets/brands/shell.png";
    const uri = resolveAssetUrl(path);
    expect(uri).toBeTruthy();
    expect(storeLogoMode(path, uri)).toBe("category");
  });
});

describe("CATEGORY_ICON_IDS", () => {
  it("covers every MCC display-group category", () => {
    expect([...CATEGORY_ICON_IDS].sort()).toEqual([...CATEGORIES].sort());
  });
});
