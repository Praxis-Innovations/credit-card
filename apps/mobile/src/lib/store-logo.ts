import { resolveAssetUrl } from "./api-client";
import { CATEGORIES, type Category } from "./api-types";

/**
 * Which mark to show for a store: the catalog logo when a URL resolves and
 * has not failed, otherwise the category icon (DS4 / MO3).
 */
export function storeLogoMode(
  logoUrl: string | null | undefined,
  failedUri: string | null = null,
): "logo" | "category" {
  const uri = resolveAssetUrl(logoUrl);
  if (uri && failedUri !== uri) return "logo";
  return "category";
}

/** Every MCC display-group category has a store-row icon. */
export const CATEGORY_ICON_IDS: readonly Category[] = CATEGORIES;
