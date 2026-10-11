import { describe, expect, it } from "vitest";
import { CATEGORIES, radioIndexForKey, rankCards } from "./try-it";

describe("rankCards", () => {
  it("ranks Triangle first for gas", () => {
    expect(rankCards("gas")).toEqual([
      expect.objectContaining({
        id: "tri",
        name: "Triangle World Elite",
        amount: "$4.00",
        why: "4× Triangle Rewards on gas",
        whyCompact: "4× points on gas",
        best: true,
      }),
      expect.objectContaining({
        id: "gold",
        name: "Scotiabank Gold Amex",
        amount: "$1.00",
        why: "1× Scene+ on gas",
        whyCompact: "1× points on gas",
        best: false,
      }),
    ]);
  });

  it("ranks Scotiabank Gold first for groceries", () => {
    expect(rankCards("groceries")).toEqual([
      expect.objectContaining({
        id: "gold",
        amount: "$5.00",
        why: "5× Scene+ on groceries",
        whyCompact: "5× points on groceries",
        best: true,
      }),
      expect.objectContaining({
        id: "tri",
        amount: "$2.00",
        why: "2× Triangle Rewards on groceries",
        whyCompact: "2× points on groceries",
        best: false,
      }),
    ]);
  });

  it("ranks Scotiabank Gold first for dining", () => {
    expect(rankCards("dining")).toEqual([
      expect.objectContaining({
        id: "gold",
        amount: "$3.00",
        why: "3× Scene+ on dining",
        whyCompact: "3× points on dining",
        best: true,
      }),
      expect.objectContaining({
        id: "tri",
        amount: "$1.00",
        why: "1× Triangle Rewards on dining",
        whyCompact: "1× points on dining",
        best: false,
      }),
    ]);
  });

  it.each(CATEGORIES.map((c) => c.id))(
    "sorts %s by rate with exactly one winner",
    (category) => {
      const ranked = rankCards(category);
      expect(ranked).toHaveLength(2);
      expect(ranked[0].rate).toBeGreaterThan(ranked[1].rate);
      expect(ranked.filter((c) => c.best)).toEqual([ranked[0]]);
    },
  );
});

describe("radioIndexForKey", () => {
  it("moves forward with Right/Down and wraps", () => {
    expect(radioIndexForKey("ArrowRight", 0, 3)).toBe(1);
    expect(radioIndexForKey("ArrowDown", 1, 3)).toBe(2);
    expect(radioIndexForKey("ArrowRight", 2, 3)).toBe(0);
  });

  it("moves back with Left/Up and wraps", () => {
    expect(radioIndexForKey("ArrowLeft", 2, 3)).toBe(1);
    expect(radioIndexForKey("ArrowUp", 1, 3)).toBe(0);
    expect(radioIndexForKey("ArrowLeft", 0, 3)).toBe(2);
  });

  it("jumps with Home/End", () => {
    expect(radioIndexForKey("Home", 2, 3)).toBe(0);
    expect(radioIndexForKey("End", 0, 3)).toBe(2);
  });

  it("ignores other keys", () => {
    expect(radioIndexForKey("Tab", 0, 3)).toBeNull();
    expect(radioIndexForKey(" ", 0, 3)).toBeNull();
    expect(radioIndexForKey("a", 0, 3)).toBeNull();
  });
});
