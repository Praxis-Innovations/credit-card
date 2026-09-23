import * as Location from "expo-location";
import type { GeoPoint } from "./places/types";

export type LocationLookupResult =
  | { ok: true; point: GeoPoint }
  | {
      ok: false;
      reason: "denied" | "unavailable" | "services_disabled";
      message: string;
    };

/**
 * Foreground, on-demand position. Never starts background updates.
 * Works on native and Expo web (browser geolocation).
 */
export async function getForegroundPosition(): Promise<LocationLookupResult> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        ok: false,
        reason: "services_disabled",
        message: "Location services are turned off on this device.",
      };
    }

    const existing = await Location.getForegroundPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }

    if (status !== "granted") {
      return {
        ok: false,
        reason: "denied",
        message: "Location permission was not granted.",
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      ok: true,
      point: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Could not read your current location.",
    };
  }
}
