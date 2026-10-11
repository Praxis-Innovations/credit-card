// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HowItWorks } from "./how-it-works";

afterEach(cleanup);

describe("HowItWorks", () => {
  it("is a section labelled by its 'How it works' heading", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 2, name: "How it works" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "How it works" })).toBeTruthy();
  });

  it("lists the three steps in order with h3 titles and the new step 3 copy", () => {
    render(<HowItWorks />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
      items.map(
        (item) => within(item).getByRole("heading", { level: 3 }).textContent,
      ),
    ).toEqual(["Add your cards", "Open it when you pay", "Use the best card"]);
    expect(
      within(items[2]!).getByText("See which card earns the most, in dollars."),
    ).toBeTruthy();
  });

  it("draws a connector after every step except the last", () => {
    const { container } = render(<HowItWorks />);
    const items = container.querySelectorAll("ol > li");
    const connectors = [...items].map(
      (li) => li.querySelector(".bg-step-line") !== null,
    );
    expect(connectors).toEqual([true, true, false]);
  });
});
