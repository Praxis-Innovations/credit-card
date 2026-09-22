import { ONBOARDING_COMPLETE_KEY } from "./storage-keys";
import { ssrSafeStorage } from "./ssr-safe-storage";

export { ONBOARDING_COMPLETE_KEY } from "./storage-keys";

export async function loadOnboardingComplete(): Promise<boolean> {
  try {
    const raw = await ssrSafeStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await ssrSafeStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
}

export async function clearOnboardingComplete(): Promise<void> {
  await ssrSafeStorage.removeItem(ONBOARDING_COMPLETE_KEY);
}
