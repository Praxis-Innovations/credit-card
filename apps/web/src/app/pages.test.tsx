// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { HOME_FAQS } from "@/lib/home";
import { SITE_URL } from "@/lib/site";
import CategoryRoute from "./[category]/page";
import HomePage from "./page";

afterEach(cleanup);

type LdNode = Record<string, unknown> & { "@type": string };

/** Every JSON-LD object on the page; throws if any script isn't valid JSON. */
function jsonLd(container: HTMLElement): LdNode[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].flatMap(
    (script) => {
      const data = JSON.parse(script.textContent ?? "") as LdNode | LdNode[];
      return Array.isArray(data) ? data : [data];
    },
  );
}

function byType(nodes: LdNode[], type: string): LdNode {
  const node = nodes.find((n) => n["@type"] === type);
  if (!node) throw new Error(`No ${type} JSON-LD`);
  return node;
}

function faqQuestions(node: LdNode): string[] {
  return (node.mainEntity as { name: string }[]).map((q) => q.name);
}

async function renderCategory(category: string) {
  return render(await CategoryRoute({ params: Promise.resolve({ category }) }));
}

describe("home page", () => {
  it("has one h1 and the keyword in the subhead", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Not sure which credit card to use\?/)).toBeTruthy();
  });

  it("server-renders the Try-it widget's default state (gas, $100)", () => {
    render(<HomePage />);
    expect(screen.getByText("$100 purchase")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Gas" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("Triangle World Elite")).toBeTruthy();
  });

  it("links the three category pages from a 'Best card by category' row and the footer", () => {
    render(<HomePage />);
    const row = screen.getByRole("region", { name: "Best card by category" });
    expect(within(row).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/gas",
      "/groceries",
      "/dining",
    ]);
    const footerNav = screen.getByRole("navigation", { name: "Categories" });
    expect(
      within(footerNav).getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual(["/gas", "/groceries", "/dining"]);
  });

  it("emits valid Organization, WebSite, SoftwareApplication and FAQPage JSON-LD", () => {
    const { container } = render(<HomePage />);
    const nodes = jsonLd(container);
    expect(nodes.map((n) => n["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    for (const node of nodes) expect(node["@context"]).toBe("https://schema.org");
    expect(byType(nodes, "Organization").url).toBe(SITE_URL);
  });

  it("FAQPage JSON-LD matches the visible FAQ", () => {
    const { container } = render(<HomePage />);
    const faq = screen.getByRole("region", { name: "Questions" });
    const visible = within(faq)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(visible).toEqual(HOME_FAQS.map((f) => f.question));
    expect(faqQuestions(byType(jsonLd(container), "FAQPage"))).toEqual(visible);
    expect(visible).toContain("Does NorthTap need my bank login?");
  });
});

describe.each(CATEGORY_PAGES.map((page) => [page.id, page] as const))(
  "/%s page",
  (category, page) => {
    it("has one h1 with the keyword, plus breadcrumbs", async () => {
      await renderCategory(category);
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s.map((h) => h.textContent)).toEqual([page.h1]);
      const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(crumbs).getByRole("link", { name: "Home" }).getAttribute("href")).toBe(
        "/",
      );
      expect(within(crumbs).getByText(page.label).getAttribute("aria-current")).toBe("page");
    });

    it("server-renders the calculator with three ranked default cards at $100", async () => {
      await renderCategory(category);
      expect(
        (screen.getByLabelText("Purchase amount") as HTMLInputElement).value,
      ).toBe("100");
      const rows = within(screen.getByRole("list", { name: "Cards, best first" })).getAllByRole(
        "listitem",
      );
      expect(rows).toHaveLength(3);
      expect(within(rows[0]!).getByText("Tap this")).toBeTruthy();
    });

    it("has the top-cards table, how-we-calculate, CTA, disclaimer and last-checked date", async () => {
      const { container } = await renderCategory(category);
      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("row")).toHaveLength(11);
      expect(
        screen.getByRole("heading", { level: 2, name: `Top cards for ${page.label.toLowerCase()}` }),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "How we calculate" })).toBeTruthy();
      expect(container.querySelector("#point-values")).toBeTruthy();
      expect(container.querySelector('a[href="#point-values"]')).toBeTruthy();
      expect(
        screen
          .getAllByRole("link", { name: "Try it with your cards" })
          .every((a) => a.getAttribute("href") === "https://northtap-app.vercel.app"),
      ).toBe(true);
      expect(screen.getAllByText(/Not financial advice/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Rates last checked/).textContent).toBe(
        "Rates last checked September 20, 2026",
      );
    });

    it("emits valid BreadcrumbList and FAQPage JSON-LD that match the page", async () => {
      const { container } = await renderCategory(category);
      const nodes = jsonLd(container);
      expect(nodes.map((n) => n["@type"])).toEqual(["BreadcrumbList", "FAQPage"]);
      expect(byType(nodes, "BreadcrumbList").itemListElement).toEqual([
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: page.label, item: `${SITE_URL}${page.path}` },
      ]);
      const faq = screen.getByRole("region", { name: "Questions" });
      const visible = within(faq)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent);
      expect(faqQuestions(byType(nodes, "FAQPage"))).toEqual(visible);
      expect(visible.length).toBeGreaterThanOrEqual(3);
    });
  },
);
