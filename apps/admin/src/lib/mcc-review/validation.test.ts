import { describe, expect, it } from "vitest";
import { validateFindingIds, validateReviewNote } from "./validation";

describe("validateReviewNote", () => {
  it("requires a note when asked", () => {
    expect(validateReviewNote("", { required: true }).ok).toBe(false);
    expect(validateReviewNote("  looks wrong  ", { required: true })).toEqual({
      ok: true,
      note: "looks wrong",
    });
  });

  it("allows empty when optional", () => {
    expect(validateReviewNote("", { required: false })).toEqual({ ok: true, note: null });
  });
});

describe("validateFindingIds", () => {
  it("dedupes and checks UUIDs", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    expect(validateFindingIds([id, id])).toEqual({ ok: true, ids: [id] });
    expect(validateFindingIds(["nope"]).ok).toBe(false);
    expect(validateFindingIds([]).ok).toBe(false);
  });
});
