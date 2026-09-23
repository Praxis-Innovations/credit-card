import {
  matchMerchantBrand,
  type MerchantBrand,
  type PlaceMatchContext,
} from "@northtap/core";
import { getForegroundPosition } from "./location";
import { getPlacesProvider, type NearbyPlace } from "./places";

export type NearbyMerchantMatch = {
  brand: MerchantBrand;
  place: NearbyPlace;
};

export type CheckNearbyResult =
  | { status: "matched"; match: NearbyMerchantMatch }
  | {
      status: "fallback";
      reason:
        | "denied"
        | "unavailable"
        | "services_disabled"
        | "no_places"
        | "no_brand_match"
        | "lookup_failed";
      message: string;
    };

function placeContext(place: NearbyPlace): PlaceMatchContext {
  return {
    placeType: place.placeType,
    tags: place.brandHints,
  };
}

/**
 * On-demand nearby merchant check: foreground location → places provider →
 * brand match against {@link MERCHANT_BRANDS}. Callers treat non-matched
 * results as a graceful fallback to the manual category picker.
 */
export async function checkNearbyMerchant(options?: {
  radiusMeters?: number;
  signal?: AbortSignal;
}): Promise<CheckNearbyResult> {
  const location = await getForegroundPosition();
  if (!location.ok) {
    return {
      status: "fallback",
      reason: location.reason,
      message: location.message,
    };
  }

  try {
    const places = await getPlacesProvider().findNearby(location.point, {
      radiusMeters: options?.radiusMeters ?? 750,
      signal: options?.signal,
    });

    if (places.length === 0) {
      return {
        status: "fallback",
        reason: "no_places",
        message: "No shops or stations found nearby.",
      };
    }

    for (const place of places) {
      const brand = matchMerchantBrand(place.name, placeContext(place));
      if (brand) {
        return { status: "matched", match: { brand, place } };
      }
      // Also try brand tag alone when name is a franchisee string.
      for (const hint of place.brandHints) {
        const fromHint = matchMerchantBrand(hint, placeContext(place));
        if (fromHint) {
          return {
            status: "matched",
            match: { brand: fromHint, place },
          };
        }
      }
    }

    return {
      status: "fallback",
      reason: "no_brand_match",
      message: "No known NorthTap merchant brands nearby.",
    };
  } catch {
    return {
      status: "fallback",
      reason: "lookup_failed",
      message: "Nearby places lookup failed.",
    };
  }
}
