import { describe, expect, it } from "vitest";
import { matchMerchantBrand, matchNearestMerchantBrand } from "./merchant-match";

describe("matchMerchantBrand", () => {
  it("matches Shell from a plain OSM name", () => {
    const brand = matchMerchantBrand("Shell");
    expect(brand?.id).toBe("shell");
    expect(brand?.category).toBe("gas");
  });

  it("matches Shoppers Drug Mart aliases", () => {
    expect(matchMerchantBrand("Shoppers Drug Mart")?.id).toBe(
      "shoppers-drug-mart",
    );
    expect(matchMerchantBrand("Shoppers")?.id).toBe("shoppers-drug-mart");
  });

  it("prefers Costco Gas when the place is a fuel amenity", () => {
    const brand = matchMerchantBrand("Costco", {
      placeType: "fuel",
      tags: ["Costco Gasoline"],
    });
    expect(brand?.id).toBe("costco-gas");
  });

  it("prefers Costco Warehouse for wholesale / supermarket context", () => {
    const brand = matchMerchantBrand("Costco Wholesale", {
      placeType: "wholesale",
    });
    expect(brand?.id).toBe("costco-warehouse");
  });

  it("returns null for unrelated places", () => {
    expect(matchMerchantBrand("Blue Bottle Coffee")).toBeNull();
    expect(matchMerchantBrand("")).toBeNull();
  });

  it("matchNearestMerchantBrand walks distance-ordered places", () => {
    const brand = matchNearestMerchantBrand([
      { name: "Independent Cafe" },
      { name: "Shell", context: { placeType: "fuel" } },
      { name: "Loblaws" },
    ]);
    expect(brand?.id).toBe("shell");
  });
});
