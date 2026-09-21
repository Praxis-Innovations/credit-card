import { GUEST_WALLET_KEY } from "./storage-keys";
import { ssrSafeStorage } from "./ssr-safe-storage";

export { GUEST_WALLET_KEY } from "./storage-keys";

export async function loadGuestWallet(): Promise<string[]> {
  try {
    const raw = await ssrSafeStorage.getItem(GUEST_WALLET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function saveGuestWallet(ids: string[]): Promise<void> {
  await ssrSafeStorage.setItem(GUEST_WALLET_KEY, JSON.stringify(ids));
}

export async function clearGuestWallet(): Promise<void> {
  await ssrSafeStorage.removeItem(GUEST_WALLET_KEY);
}
