// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CategoryPageView } from "@/components/category-page";
import { getCategoryPage, getCategoryPageData } from "@/lib/category-pages";
import { CardCalculator, parseAmount, rankPicks } from "./card-calculator";
import type { CalculatorCard } from "./card-calculator";

afterEach(cleanup);

const CARDS: CalculatorCard[] = [
  { id: "a", name: "Alpha Card", issuer: "BMO", rank: 0, centsPerDollar: 4.8, detail: "2× MR" },
  { id: "b", name: "Beta Card", issuer: "TD", rank: 1, centsPerDollar: 3, detail: "3% cash back" },
  { id: "c", name: "Gamma Card", issuer: "TD", rank: 2, centsPerDollar: 1, detail: "1% cash back" },
];

function rows() {
  return within(screen.getByRole("list", { name: "Cards, best first" })).getAllByRole("listitem");
}

function rowSummary() {
  return rows().map((row) => [
    row.getAttribute("data-card"),
    row.textContent?.match(/\$[\d,]+\.\d{2}/)?.[0],
  ]);
}

function renderCalculator(defaultPicks = ["c", "a", "b"]) {
  return render(
    <CardCalculator
      categoryNoun="gas"
      cards={CARDS}
      defaultPicks={defaultPicks}
      defaultAmount={100}
      maxPicks={3}
    />,
  );
}

describe("parseAmount", () => {
  it("accepts plain, $-prefixed and comma amounts", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount(" $1,250.50 ")).toBe(1250.5);
  });

  it("rejects empty, non-numeric, zero, negative and huge amounts", () => {
    for (const value of ["", "abc", "0", "-5", "100001"]) {
      expect(parseAmount(value)).toBeNull();
    }
  });
});

describe("rankPicks", () => {
  it("orders picks by category rank, skipping blanks and duplicates", () => {
    expect(rankPicks(CARDS, ["c", "", "a", "c"]).map((c) => c.id)).toEqual(["a", "c"]);
  });
});

describe("CardCalculator", () => {
  it("ranks the default picks best first with dollars back on $100", () => {
    renderCalculator();
    expect(rowSummary()).toEqual([
      ["a", "$4.80"],
      ["b", "$3.00"],
      ["c", "$1.00"],
    ]);
    expect(within(rows()[0]!).getByText("Tap this")).toBeTruthy();
    expect(screen.getAllByText("Tap this")).toHaveLength(1);
  });

  it("recomputes dollars back when the amount changes", () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText("Purchase amount"), { target: { value: "250" } });
    expect(rowSummary()).toEqual([
      ["a", "$12.00"],
      ["b", "$7.50"],
      ["c", "$2.50"],
    ]);
  });

  it("flags an invalid amount without crashing", () => {
    renderCalculator();
    const input = screen.getByLabelText("Purchase amount");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Enter a dollar amount/)).toBeTruthy();
  });

  it("re-ranks when a card is changed or removed, and dedupes repeats", () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText("Card 2"), { target: { value: "" } });
    expect(rowSummary().map(([id]) => id)).toEqual(["b", "c"]);

    fireEvent.change(screen.getByLabelText("Card 3"), { target: { value: "c" } });
    expect(rowSummary().map(([id]) => id)).toEqual(["c"]);
  });

  it("shows a prompt when no cards are picked", () => {
    renderCalculator(["", "", ""]);
    expect(screen.queryByRole("list", { name: "Cards, best first" })).toBeNull();
    expect(screen.getByText("Pick a card to see what it earns on gas.")).toBeTruthy();
  });
});

describe.each([
  // Default picks per page, best first, on $100.
  ["gas", [["amex-cobalt", "$4.80"], ["triangle-we", "$4.00"], ["td-aeroplan-vi", "$3.00"]]],
  ["groceries", [["amex-cobalt", "$12.00"], ["scotia-gold-amex", "$5.00"], ["pc-financial-we", "$3.00"]]],
  ["dining", [["amex-cobalt", "$12.00"], ["scotia-gold-amex", "$3.00"], ["td-aeroplan-vi", "$3.00"]]],
])("%s calculator on the catalog snapshot", (category, expected) => {
  it("ranks the default cards", () => {
    render(<CategoryPageView data={getCategoryPageData(getCategoryPage(category)!)} />);
    expect(rowSummary()).toEqual(expected);
  });

  it("offers every catalog card, grouped by issuer, in each of the three pickers", () => {
    const data = getCategoryPageData(getCategoryPage(category)!);
    render(<CategoryPageView data={data} />);
    for (const label of ["Card 1", "Card 2", "Card 3"]) {
      const select = screen.getByLabelText(label) as HTMLSelectElement;
      expect(select.querySelectorAll("option[value]:not([value=''])")).toHaveLength(
        data.ranked.length,
      );
      expect(select.querySelectorAll("optgroup").length).toBeGreaterThan(5);
    }
  });
});
