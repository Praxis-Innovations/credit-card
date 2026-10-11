// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { TryItWidget } from "./try-it-widget";

afterEach(cleanup);

function radios() {
  const group = screen.getByRole("radiogroup", {
    name: "What are you buying?",
  });
  return within(group).getAllByRole("radio");
}

function radio(name: string) {
  return screen.getByRole("radio", { name });
}

function rows() {
  const list = screen.getByRole("list", { name: "Cards, best first" });
  return within(list).getAllByRole("listitem");
}

function expectSelected(name: string) {
  for (const r of radios()) {
    const selected = r.textContent === name;
    expect(r.getAttribute("aria-checked")).toBe(String(selected));
    expect(r.tabIndex).toBe(selected ? 0 : -1);
  }
}

describe("TryItWidget radiogroup", () => {
  it("renders a labelled radiogroup with Gas selected by default", () => {
    render(<TryItWidget />);
    expect(radios().map((r) => r.textContent)).toEqual([
      "Gas",
      "Groceries",
      "Dining",
    ]);
    expectSelected("Gas");
  });

  it("selects and focuses the next radio with ArrowRight/ArrowDown, wrapping", () => {
    render(<TryItWidget />);
    radio("Gas").focus();

    fireEvent.keyDown(radio("Gas"), { key: "ArrowRight" });
    expectSelected("Groceries");
    expect(document.activeElement).toBe(radio("Groceries"));

    fireEvent.keyDown(radio("Groceries"), { key: "ArrowDown" });
    expectSelected("Dining");
    expect(document.activeElement).toBe(radio("Dining"));

    fireEvent.keyDown(radio("Dining"), { key: "ArrowRight" });
    expectSelected("Gas");
    expect(document.activeElement).toBe(radio("Gas"));
  });

  it("selects the previous radio with ArrowLeft/ArrowUp, wrapping", () => {
    render(<TryItWidget />);
    radio("Gas").focus();

    fireEvent.keyDown(radio("Gas"), { key: "ArrowLeft" });
    expectSelected("Dining");
    expect(document.activeElement).toBe(radio("Dining"));

    fireEvent.keyDown(radio("Dining"), { key: "ArrowUp" });
    expectSelected("Groceries");
  });

  it("jumps to the ends with Home/End", () => {
    render(<TryItWidget />);
    fireEvent.keyDown(radio("Gas"), { key: "End" });
    expectSelected("Dining");
    fireEvent.keyDown(radio("Dining"), { key: "Home" });
    expectSelected("Gas");
  });

  it("selects on click", () => {
    render(<TryItWidget />);
    fireEvent.click(radio("Dining"));
    expectSelected("Dining");
  });
});

describe("TryItWidget ranking", () => {
  it.each([
    ["Gas", "Triangle World Elite", "$4.00", "Scotiabank Gold Amex", "$1.00"],
    ["Groceries", "Scotiabank Gold Amex", "$5.00", "Triangle World Elite", "$2.00"],
    ["Dining", "Scotiabank Gold Amex", "$3.00", "Triangle World Elite", "$1.00"],
  ])(
    "%s: %s wins with %s, then %s with %s",
    (category, winner, winnerAmount, runnerUp, runnerUpAmount) => {
      render(<TryItWidget />);
      fireEvent.click(radio(category));

      const [first, second] = rows();
      expect(first.textContent).toContain(winner);
      expect(first.textContent).toContain(winnerAmount);
      expect(within(first).getByText("Tap this")).toBeTruthy();
      expect(within(first).queryByText("Earns less")).toBeNull();

      expect(second.textContent).toContain(runnerUp);
      expect(second.textContent).toContain(runnerUpAmount);
      expect(within(second).getByText("Earns less")).toBeTruthy();
      expect(within(second).queryByText("Tap this")).toBeNull();

      expect(screen.getAllByText("Tap this")).toHaveLength(1);
      expect(screen.getAllByText("Earns less")).toHaveLength(1);
    },
  );

  it("captions each amount with 'back'", () => {
    render(<TryItWidget />);
    for (const row of rows()) {
      expect(within(row).getByText("back")).toBeTruthy();
    }
  });

  it("shows the why text and the footnote", () => {
    render(<TryItWidget />);
    expect(screen.getByText("4× Triangle Rewards on gas")).toBeTruthy();
    expect(screen.getByText("1× Scene+ on gas")).toBeTruthy();
    expect(
      screen.getByText(
        "Example with two real Canadian cards, points valued at 1¢. In the app, it uses your own cards.",
      ),
    ).toBeTruthy();
  });
});
