import type { PointCurrency, PointValuations } from "./schema";

/**
 * Default valuations in cents CAD per point.
 * Cashback is 1.0 (1¢ earned = 1¢ value).
 * These are overridable via recommendCards({ valuations }).
 */
export const DEFAULT_POINT_VALUATIONS: Record<PointCurrency, number> = {
  Aeroplan: 2.0,
  "Scene+": 1.0,
  "TD Rewards": 0.5,
  "RBC Avion": 1.7,
  "CIBC Aventura": 1.2,
  "Amex MR": 2.4,
  "BMO Rewards": 0.7,
  WestJet: 1.0,
  "AIR MILES": 1.5,
  "Marriott Bonvoy": 0.7,
  cashback: 1.0,
  "PC Optimum": 1.0,
  Rogers: 1.5,
  Triangle: 1.0,
  /** 500 Moi points = $4 off at participating Metro banners → 0.8¢/pt. */
  Moi: 0.8,
};

export function resolveValuations(
  overrides?: Partial<Record<PointCurrency, number>>,
): PointValuations {
  return { ...DEFAULT_POINT_VALUATIONS, ...overrides };
}
