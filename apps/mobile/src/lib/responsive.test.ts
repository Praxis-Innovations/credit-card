import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" }, useWindowDimensions: vi.fn() }));

const { layoutFor } = await import("./responsive");

describe("layoutFor", () => {
  it("keeps web phones full width with three tiles per row", () => {
    for (const width of [320, 390, 599]) {
      expect(layoutFor(width, true)).toMatchObject({
        size: "phone",
        wide: false,
        desktop: false,
        columnMaxWidth: undefined,
        tilesPerRow: 3,
      });
    }
  });

  it("centres a 560px column with four tiles on tablets", () => {
    for (const width of [600, 820, 1023]) {
      expect(layoutFor(width, true)).toMatchObject({
        size: "tablet",
        wide: true,
        desktop: false,
        columnMaxWidth: 560,
        tilesPerRow: 4,
      });
    }
  });

  it("centres a 640px column with five tiles on desktop", () => {
    for (const width of [1024, 1440, 1920]) {
      expect(layoutFor(width, true)).toMatchObject({
        size: "desktop",
        wide: true,
        desktop: true,
        columnMaxWidth: 640,
        tilesPerRow: 5,
      });
    }
  });

  it("always gives native the capped phone layout", () => {
    for (const width of [390, 820, 1366]) {
      expect(layoutFor(width, false)).toMatchObject({
        size: "phone",
        wide: false,
        columnMaxWidth: 480,
        tilesPerRow: 3,
      });
    }
  });
});
