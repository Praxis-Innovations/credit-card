import type {
  FindNearbyOptions,
  GeoPoint,
  NearbyPlace,
  PlacesProvider,
} from "./types";

const DEFAULT_RADIUS_M = 750;
const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  // Fuel + grocery / pharmacy / wholesale — the banners we can match in core.
  return `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${lat},${lon})["amenity"="fuel"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="supermarket"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="convenience"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="chemist"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="pharmacy"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="wholesale"];
  nwr(around:${radiusMeters},${lat},${lon})["shop"="mall"];
  nwr(around:${radiusMeters},${lat},${lon})["amenity"="pharmacy"];
);
out center tags;
`.trim();
}

function elementCoords(
  el: OverpassElement,
): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && typeof el.center.lat === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function toNearbyPlace(
  el: OverpassElement,
  origin: GeoPoint,
): NearbyPlace | null {
  const coords = elementCoords(el);
  if (!coords) return null;
  const tags = el.tags ?? {};
  const name =
    tags.name?.trim() ||
    tags.brand?.trim() ||
    tags.operator?.trim() ||
    "";
  if (!name) return null;

  const brandHints = [
    tags.brand,
    tags["brand:en"],
    tags.name,
    tags["name:en"],
    tags.operator,
    tags["operator:en"],
  ].filter((v): v is string => Boolean(v && v.trim()));

  const placeType = tags.amenity || tags.shop || undefined;

  return {
    id: `${el.type}/${el.id}`,
    name,
    latitude: coords.lat,
    longitude: coords.lon,
    distanceMeters: haversineMeters(
      origin.latitude,
      origin.longitude,
      coords.lat,
      coords.lon,
    ),
    placeType,
    brandHints,
    rawTags: tags,
  };
}

export type OverpassPlacesProviderOptions = {
  /** Overpass interpreter URL. */
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Free, keyless nearby-merchant lookup via the OSM Overpass API.
 */
export function createOverpassPlacesProvider(
  options: OverpassPlacesProviderOptions = {},
): PlacesProvider {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "overpass",
    async findNearby(point, findOptions: FindNearbyOptions = {}) {
      const radiusMeters = findOptions.radiusMeters ?? DEFAULT_RADIUS_M;
      const query = buildQuery(point.latitude, point.longitude, radiusMeters);

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
        ...(findOptions.signal
          ? { signal: findOptions.signal as RequestInit["signal"] }
          : {}),
      });

      if (!response.ok) {
        throw new Error(
          `Overpass request failed (${response.status} ${response.statusText})`,
        );
      }

      const data = (await response.json()) as OverpassResponse;
      const places = (data.elements ?? [])
        .map((el) => toNearbyPlace(el, point))
        .filter((p): p is NearbyPlace => p !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      // De-dupe by normalized name within ~40m (ways + nodes for same station).
      const seen = new Set<string>();
      const deduped: NearbyPlace[] = [];
      for (const place of places) {
        const key = `${place.name.toLowerCase()}@${Math.round(place.latitude * 2500)}:${Math.round(place.longitude * 2500)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(place);
      }
      return deduped;
    },
  };
}
