import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { PHONE_COLUMN } from "./theme";

export type LayoutSize = "phone" | "tablet" | "desktop";

export const TABLET_MIN_WIDTH = 600;
export const DESKTOP_MIN_WIDTH = 1024;

/** Content width from the approved boards (820 → 704, 1440 → 1040). */
export const CONTENT_WIDTH = { tablet: 704, desktop: 1040 } as const;

/** Smallest side margin when the window is narrower than the board frame. */
const MIN_GUTTER = { tablet: 24, desktop: 32 } as const;

export interface Layout {
  size: LayoutSize;
  /** Tablet or desktop web. */
  wide: boolean;
  desktop: boolean;
  /**
   * Fixed, centred content width on tablet/desktop web — the same on every
   * screen. Undefined on phones (full width with side padding).
   */
  contentWidth: number | undefined;
  /** Native column cap; undefined on web phones (full width). */
  columnMaxWidth: number | undefined;
  tilesPerRow: number;
}

const TILES: Record<LayoutSize, number> = { phone: 3, tablet: 4, desktop: 6 };

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
  const contentWidth =
    size === "phone"
      ? undefined
      : Math.min(CONTENT_WIDTH[size], Math.floor(width - 2 * MIN_GUTTER[size]));
  return {
    size,
    wide: size !== "phone",
    desktop: size === "desktop",
    contentWidth,
    columnMaxWidth: web ? undefined : PHONE_COLUMN,
    tilesPerRow: TILES[size],
  };
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutFor(width, Platform.OS === "web"), [width]);
}
