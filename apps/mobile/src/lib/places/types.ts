/**
 * Places provider interface — swap Overpass for Google/Foursquare later
 * by changing {@link getPlacesProvider}, not call sites.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  /** OSM amenity / shop value when present. */
  placeType?: string;
  /** Candidate brand strings from OSM tags (brand, name, operator, …). */
  brandHints: string[];
  rawTags: Record<string, string>;
}

export interface FindNearbyOptions {
  /** Search radius in meters. Default 750. */
  radiusMeters?: number;
  /** Optional AbortSignal for timeouts / unmount. */
  signal?: AbortSignal;
}

export interface PlacesProvider {
  readonly id: string;
  findNearby(
    point: GeoPoint,
    options?: FindNearbyOptions,
  ): Promise<NearbyPlace[]>;
}
