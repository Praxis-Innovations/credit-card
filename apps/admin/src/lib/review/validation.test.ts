import { describe, expect, it } from "vitest";
import { validateRejectReason, validateReviewFields } from "./validation";

describe("validateRejectReason", () => {
  it("requires a non-empty reason", () => {
    expect(validateRejectReason("")).toEqual({ ok: false, error: "Give a reason for rejecting." });
    expect(validateRejectReason("  ")).toEqual({ ok: false, error: "Give a reason for rejecting." });
  });

  it("trims and accepts a normal reason", () => {
    expect(validateRejectReason("  Fee is wrong.  ")).toEqual({ ok: true, reason: "Fee is wrong." });
  });
});

describe("validateReviewFields", () => {
  const keys = new Set(["annual_fee", "name"]);

  it("accepts one decision per allowed key", () => {
    const res = validateReviewFields(
      {
        fields: [
          { key: "annual_fee", save: true, page_value: "59", value: "599" },
          { key: "name", save: false, page_value: "Gold", value: "Gold" },
        ],
      },
      keys,
    );
    expect(res).toEqual({
      ok: true,
      fields: {
        fields: [
          { key: "annual_fee", save: true, page_value: "59", value: "599" },
          { key: "name", save: false, page_value: "Gold", value: "Gold" },
        ],
      },
    });
  });

  it("rejects unknown, duplicate, or incomplete field sets", () => {
    expect(validateReviewFields({ fields: [{ key: "x", save: true, page_value: "1", value: "1" }] }, keys).ok).toBe(
      false,
    );
    expect(
      validateReviewFields(
        {
          fields: [
            { key: "annual_fee", save: true, page_value: "1", value: "1" },
            { key: "annual_fee", save: true, page_value: "1", value: "1" },
          ],
        },
        keys,
      ).ok,
    ).toBe(false);
    expect(
      validateReviewFields({ fields: [{ key: "annual_fee", save: true, page_value: "1", value: "1" }] }, keys).ok,
    ).toBe(false);
  });

  it("allows an empty decision list when there are no fields", () => {
    expect(validateReviewFields({ fields: [] }, new Set())).toEqual({ ok: true, fields: { fields: [] } });
  });
});
