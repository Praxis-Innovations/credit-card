export const GUEST_WALLET_KEY = "northtap.ownedCardIds";

/** Set once the first-run onboarding sequence is finished. */
export const ONBOARDING_COMPLETE_KEY = "northtap.onboardingComplete";

/**
 * Last successful /v1/recommendations payload (plus the store it was for) for
 * offline display. v2: category-only ranking; v1 entries may hold partnership
 * results and are ignored.
 */
export const LAST_RECOMMENDATION_CACHE_KEY = "northtap.lastRecommendation.v2";
