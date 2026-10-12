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
        contentWidth: undefined,
        columnMaxWidth: undefined,
        tilesPerRow: 3,
      });
    }
  });

  it("uses the fixed 704px tablet content width with four tiles", () => {
    for (const width of [752, 820, 1023]) {
      expect(layoutFor(width, true)).toMatchObject({
        size: "tablet",
        wide: true,
        desktop: false,
        contentWidth: 704,
        tilesPerRow: 4,
      });
    }
  });

  it("uses the fixed 1040px desktop content width with six tiles", () => {
    for (const width of [1104, 1440, 1920]) {
      expect(layoutFor(width, true)).toMatchObject({
        size: "desktop",
        wide: true,
        desktop: true,
        contentWidth: 1040,
        tilesPerRow: 6,
      });
    }
  });

  it("only narrows the content when the window can't fit it", () => {
    expect(layoutFor(600, true).contentWidth).toBe(552);
    expect(layoutFor(1024, true).contentWidth).toBe(960);
  });

  it("always gives native the capped phone layout", () => {
    for (const width of [390, 820, 1366]) {
      expect(layoutFor(width, false)).toMatchObject({
        size: "phone",
        wide: false,
        contentWidth: undefined,
        columnMaxWidth: 480,
        tilesPerRow: 3,
      });
    }
  });
});
