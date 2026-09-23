export const GUEST_WALLET_KEY = "northtap.ownedCardIds";

/** Set once the first-run onboarding sequence is finished. */
export const ONBOARDING_COMPLETE_KEY = "northtap.onboardingComplete";

/**
 * Cached CreditCard snapshots for the caller's wallet (offline recommend fallback).
 * Bounded by wallet size — not the full catalog.
 */
export const WALLET_CARD_CACHE_KEY = "northtap.walletCardCache";
