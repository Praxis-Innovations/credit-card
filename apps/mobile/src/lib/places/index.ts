import { createOverpassPlacesProvider } from "./overpass";
import type { PlacesProvider } from "./types";

export type {
  FindNearbyOptions,
  GeoPoint,
  NearbyPlace,
  PlacesProvider,
} from "./types";
export { createOverpassPlacesProvider } from "./overpass";

/**
 * Active places backend. Default is Overpass (free, no API key).
 * Assign a different {@link PlacesProvider} (Google / Foursquare) to swap.
 */
let activeProvider: PlacesProvider = createOverpassPlacesProvider();

export function setPlacesProvider(provider: PlacesProvider): void {
  activeProvider = provider;
}

export function getPlacesProvider(): PlacesProvider {
  return activeProvider;
}

export function resetPlacesProvider(): void {
  activeProvider = createOverpassPlacesProvider();
}
