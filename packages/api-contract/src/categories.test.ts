import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS } from "./categories";

describe("@northtap/api-contract categories", () => {
  it("has a label for every category id", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...CATEGORIES].sort());
  });
});
