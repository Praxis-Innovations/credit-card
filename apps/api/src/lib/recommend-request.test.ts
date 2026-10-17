import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  mapSharedStoreFields,
  parseNonNegativeIdMap,
  parseSpendToDate,
  parseValuations,
} from "./recommend-request";

function expectBadRequest(fn: () => unknown, message?: RegExp | string): void {
  try {
    fn();
    expect.fail("expected ApiError");
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(400);
    expect(e.code).toBe("bad_request");
    if (message) expect(e.message).toMatch(message);
  }
}

describe("parseSpendToDate", () => {
  it("accepts valid category maps", () => {
    expect(
      parseSpendToDate({ monthly: { groceries: 100 }, annual: { dining: 0 } }),
    ).toEqual({ monthly: { groceries: 100 }, annual: { dining: 0 } });
  });

  it("rejects NaN, strings, unknown categories, and huge maps", () => {
    expectBadRequest(
      () => parseSpendToDate({ monthly: { groceries: Number.NaN } }),
      /finite/,
    );
    expectBadRequest(
      () => parseSpendToDate({ monthly: { groceries: "100" } }),
      /finite/,
    );
    expectBadRequest(
      () => parseSpendToDate({ monthly: { warehouse: 10 } }),
      /unknown category/,
    );
    expectBadRequest(
      () => parseSpendToDate({ weekly: { groceries: 10 } }),
      /unknown key/,
    );
    const huge: Record<string, number> = {};
    for (let i = 0; i < 20; i++) huge[`c${i}`] = 1;
    expectBadRequest(() => parseSpendToDate({ monthly: huge }), /too many/);
  });
});

describe("parseValuations", () => {
  it("accepts known currencies in range", () => {
    expect(parseValuations({ "Amex MR": 2.4, cashback: 1 })).toEqual({
      "Amex MR": 2.4,
      cashback: 1,
    });
  });

  it("rejects non-finite, unknown currencies, zero, and out-of-range", () => {
    expectBadRequest(() => parseValuations({ Aeroplan: Number.POSITIVE_INFINITY }));
    expectBadRequest(() => parseValuations({ FakePoints: 1 }), /unknown currency/);
    expectBadRequest(() => parseValuations({ Aeroplan: 0 }), /greater than 0/);
    expectBadRequest(() => parseValuations({ Aeroplan: -1 }), /greater than 0/);
    expectBadRequest(() => parseValuations({ Aeroplan: 101 }), /<= 100/);
    expectBadRequest(() => parseValuations({ Aeroplan: "2" }), /finite/);
  });
});

describe("parseNonNegativeIdMap", () => {
  it("rejects arrays, NaN, negatives, and oversized maps", () => {
    expectBadRequest(() => parseNonNegativeIdMap([], "capGroupSpendToDate"));
    expectBadRequest(
      () => parseNonNegativeIdMap({ "cobalt-5x": Number.NaN }, "capGroupSpendToDate"),
    );
    expectBadRequest(
      () => parseNonNegativeIdMap({ "amex-cobalt": -5 }, "annualSpendByCard"),
    );
    const huge: Record<string, number> = {};
    for (let i = 0; i < 65; i++) huge[`id-${i}`] = 1;
    expectBadRequest(
      () => parseNonNegativeIdMap(huge, "annualSpendByCard"),
      /too many/,
    );
  });
});

describe("mapSharedStoreFields", () => {
  it("parses spend and valuation maps instead of casting", () => {
    const shared = mapSharedStoreFields({
      spendToDate: { monthly: { gas: 50 } },
      valuations: { "Scene+": 1.2 },
    });
    expect(shared.spendToDate).toEqual({ monthly: { gas: 50 } });
    expect(shared.valuations).toEqual({ "Scene+": 1.2 });
  });

  it("throws bad_request for invalid nested maps", () => {
    expectBadRequest(() =>
      mapSharedStoreFields({
        spendToDate: { monthly: { groceries: Number.NaN } },
      }),
    );
  });
});
