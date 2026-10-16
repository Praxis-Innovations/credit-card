import type { MccCertainty } from "../api-types";

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
  /** OSM amenity / shop / tourism / railway value when present. */
  placeType?: string;
  /** Full OSM tag for API store-type fallback, e.g. `shop=supermarket`. */
  osmTag?: string;
  /** Store-type MCC estimate from the OSM tag (brand codes override on the API). */
  mcc?: string;
  /** Confidence for the place's MCC: `estimate` from the map tag, else unknown. */
  certainty?: MccCertainty;
  /** Candidate brand strings from OSM tags (brand, name, operator, …). */
  brandHints: string[];
  rawTags: Record<string, string>;
}

export interface FindNearbyOptions {
  /** Search radius in meters. Default 750. */
  radiusMeters?: number;
  /** Max places returned, nearest first. Default 100. */
  limit?: number;
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
