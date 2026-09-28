import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { PHONE_COLUMN } from "./theme";

export type LayoutSize = "phone" | "tablet" | "desktop";

export const TABLET_MIN_WIDTH = 600;
export const DESKTOP_MIN_WIDTH = 1024;

export interface Layout {
  size: LayoutSize;
  /** Tablet or desktop web. */
  wide: boolean;
  desktop: boolean;
  /** Max width of the centred app column; undefined = full width. */
  columnMaxWidth: number | undefined;
  tilesPerRow: number;
}

const WEB_COLUMNS: Record<LayoutSize, number | undefined> = {
  phone: undefined,
  tablet: 560,
  desktop: 640,
};

const TILES: Record<LayoutSize, number> = { phone: 3, tablet: 4, desktop: 5 };

/**
 * Web-only breakpoints. Native always gets the phone layout (with the
 * existing phone-width cap), so iOS/Android screens don't change.
 */
export function layoutFor(width: number, web: boolean): Layout {
  const size: LayoutSize = !web
    ? "phone"
    : width >= DESKTOP_MIN_WIDTH
      ? "desktop"
      : width >= TABLET_MIN_WIDTH
        ? "tablet"
        : "phone";
  return {
    size,
    wide: size !== "phone",
    desktop: size === "desktop",
    columnMaxWidth: web ? WEB_COLUMNS[size] : PHONE_COLUMN,
    tilesPerRow: TILES[size],
  };
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutFor(width, Platform.OS === "web"), [width]);
}
