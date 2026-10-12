import { getPlacesProvider, type GeoPoint, type NearbyPlace } from "./places";

export type NearbyPlacesResult =
  | { status: "ok"; places: NearbyPlace[] }
  | { status: "lookup_failed"; message: string };

/**
 * All places the provider returns around `point`, nearest first. The query
 * goes straight from the device to the places provider (OSM Overpass) —
 * never through NorthTap's servers.
 */
export async function findNearbyPlaces(
  point: GeoPoint,
  options?: { radiusMeters?: number; signal?: AbortSignal },
): Promise<NearbyPlacesResult> {
  try {
    const places = await getPlacesProvider().findNearby(point, {
      radiusMeters: options?.radiusMeters ?? 750,
      signal: options?.signal,
    });
    return { status: "ok", places };
  } catch {
    return { status: "lookup_failed", message: "Nearby places lookup failed." };
  }
}
