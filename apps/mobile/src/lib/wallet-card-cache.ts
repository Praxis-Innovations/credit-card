import type { CreditCard } from "@northtap/core";
import { WALLET_CARD_CACHE_KEY } from "./storage-keys";
import { ssrSafeStorage } from "./ssr-safe-storage";

/**
 * Bounded local cache of CreditCard rows for the caller's current wallet.
 * Used only for offline category ranking when apps/api is unreachable.
 * Never stores user identity — just catalog snapshots keyed by card id.
 */

export async function loadWalletCardCache(): Promise<CreditCard[]> {
  try {
    const raw = await ssrSafeStorage.getItem(WALLET_CARD_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCreditCardLike);
  } catch {
    return [];
  }
}

/**
 * Merge card snapshots into the cache, keeping only `ownedCardIds` when provided
 * so the store stays bounded by wallet size.
 */
export async function mergeWalletCardCache(
  cards: CreditCard[],
  ownedCardIds?: string[],
): Promise<void> {
  const owned = ownedCardIds ? new Set(ownedCardIds) : null;
  const existing = await loadWalletCardCache();
  const byId = new Map<string, CreditCard>();

  for (const card of existing) {
    if (!owned || owned.has(card.id)) byId.set(card.id, card);
  }
  for (const card of cards) {
    if (!owned || owned.has(card.id)) byId.set(card.id, card);
  }

  const next = [...byId.values()];
  await ssrSafeStorage.setItem(WALLET_CARD_CACHE_KEY, JSON.stringify(next));
}

export async function clearWalletCardCache(): Promise<void> {
  await ssrSafeStorage.removeItem(WALLET_CARD_CACHE_KEY);
}

function isCreditCardLike(value: unknown): value is CreditCard {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.issuer === "string" &&
    typeof v.annualFee === "number" &&
    typeof v.pointCurrency === "string" &&
    Array.isArray(v.rewardCategories) &&
    typeof v.lastVerified === "string"
  );
}
