import type { Page } from "@playwright/test";

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/**
 * Overpass is an external OSM dependency — mock it so nearby tiles are
 * deterministic. Location coordinates never go to the NorthTap API.
 */
export async function installOverpassMock(page: Page) {
  const bodies: string[] = [];
  await page.route("**/api/interpreter", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill(
      json({
        elements: [
          {
            type: "node",
            id: 1,
            lat: 43.6631,
            lon: -79.3959,
            tags: { amenity: "fuel", brand: "Shell", name: "Shell" },
          },
          {
            type: "node",
            id: 2,
            lat: 43.664,
            lon: -79.395,
            tags: {
              amenity: "pharmacy",
              brand: "Shoppers Drug Mart",
              name: "Shoppers Drug Mart",
            },
          },
          {
            type: "node",
            id: 3,
            lat: 43.665,
            lon: -79.397,
            tags: { shop: "convenience", name: "Harbord Convenience" },
          },
        ],
      }),
    );
  });
  return { bodies };
}
