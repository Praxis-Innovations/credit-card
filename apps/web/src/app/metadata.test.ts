import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { CATEGORY_PAGES_INDEXABLE, SITE_URL } from "@/lib/site";
import { generateMetadata, generateStaticParams } from "./[category]/page";
import { metadata as homeMetadata } from "./page";
import RootLayout, { metadata as layoutMetadata } from "./layout";

vi.mock("next/font/google", () => ({
  DM_Sans: () => ({ variable: "font-dm-sans" }),
  Syne: () => ({ variable: "font-syne" }),
}));

function expectPageMetadata(
  metadata: Metadata,
  expected: { title: string; url: string; index: boolean },
) {
  expect(metadata.title).toEqual({ absolute: expected.title });
  expect(typeof metadata.description).toBe("string");
  expect((metadata.description as string).length).toBeGreaterThan(70);
  expect((metadata.description as string).length).toBeLessThanOrEqual(170);
  expect(metadata.alternates?.canonical).toBe(expected.url);
  expect(metadata.robots).toEqual({ index: expected.index, follow: true });
  expect(metadata.openGraph).toMatchObject({
    type: "website",
    siteName: "NorthTap",
    locale: "en_CA",
    url: expected.url,
    title: expected.title,
    description: metadata.description,
  });
  expect(metadata.twitter).toMatchObject({
    card: "summary_large_image",
    title: expected.title,
    description: metadata.description,
  });
}

describe("root layout", () => {
  it("sets metadataBase from SITE_URL and en_CA Open Graph defaults", () => {
    expect(layoutMetadata.metadataBase?.toString()).toBe(`${SITE_URL}/`);
    expect(layoutMetadata.openGraph).toMatchObject({ locale: "en_CA" });
  });

  it("renders <html lang='en-CA'> with the self-hosted font variables", () => {
    const html = renderToStaticMarkup(RootLayout({ children: null }));
    expect(html).toMatch(/^<html lang="en-CA"/);
    expect(html).toContain("font-dm-sans");
    expect(html).toContain("font-syne");
    expect(html).not.toContain("fonts.googleapis.com");
  });
});

describe("home metadata", () => {
  it("targets 'which credit card to use' and is indexable", () => {
    expectPageMetadata(homeMetadata, {
      title: "Which credit card to use? The best card for every purchase · NorthTap",
      url: SITE_URL,
      index: true,
    });
    expect(String(homeMetadata.description).toLowerCase()).toContain(
      "which credit card to use",
    );
  });
});

describe("category metadata", () => {
  it("prerenders exactly gas, groceries and dining", () => {
    expect(generateStaticParams()).toEqual([
      { category: "gas" },
      { category: "groceries" },
      { category: "dining" },
    ]);
  });

  it.each([
    ["gas", "Which credit card to use for gas in Canada · NorthTap"],
    ["groceries", "Which credit card to use for groceries in Canada · NorthTap"],
    ["dining", "Which credit card to use at restaurants in Canada · NorthTap"],
  ])("/%s has its own title and canonical; robots follow the indexable flag", async (category, title) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ category }) });
    expectPageMetadata(metadata, {
      title,
      url: `${SITE_URL}/${category}`,
      index: CATEGORY_PAGES_INDEXABLE,
    });
  });

  it("uses unique titles and descriptions", () => {
    const titles = new Set(CATEGORY_PAGES.map((page) => page.title));
    const descriptions = new Set(CATEGORY_PAGES.map((page) => page.description));
    expect(titles.size).toBe(CATEGORY_PAGES.length);
    expect(descriptions.size).toBe(CATEGORY_PAGES.length);
  });
});
