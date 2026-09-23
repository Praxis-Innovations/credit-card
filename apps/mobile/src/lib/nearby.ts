import { getForegroundPosition } from "./location";
import { getPlacesProvider, type NearbyPlace } from "./places";

export type NearbyPlaceHit = {
  place: NearbyPlace;
  /** Raw name / brand string to send as merchantQuery to the API. */
  merchantQuery: string;
};

export type CheckNearbyResult =
  | { status: "found"; hit: NearbyPlaceHit }
  | {
      status: "fallback";
      reason:
        | "denied"
        | "unavailable"
        | "services_disabled"
        | "no_places"
        | "lookup_failed";
      message: string;
    };

/**
 * On-demand nearby place check: foreground location → places provider →
 * nearest POI. Does **not** match against the NorthTap merchant catalog —
 * the API resolves `merchantQuery` server-side.
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

    // Provider returns places sorted by distance — take the nearest with a name.
    const place =
      places.find((p) => p.name.trim().length > 0) ?? places[0]!;
    const merchantQuery =
      place.brandHints.find((h) => h.trim().length > 0)?.trim() ||
      place.name.trim();

    if (!merchantQuery) {
      return {
        status: "fallback",
        reason: "no_places",
        message: "No shops or stations found nearby.",
      };
    }

    return {
      status: "found",
      hit: { place, merchantQuery },
    };
  } catch {
    return {
      status: "fallback",
      reason: "lookup_failed",
      message: "Nearby places lookup failed.",
    };
  }
}
