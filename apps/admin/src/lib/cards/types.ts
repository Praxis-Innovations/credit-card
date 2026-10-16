export type CatalogStatus = "pending" | "verified" | "stale" | "rejected";

export type AssetRightsStatus =
  | "licensed"
  | "issuer_provided"
  | "placeholder"
  | "unknown"
  | "generated";

export type RewardCategory = {
  category: string;
  earnRate: number;
  capMonthly?: number | null;
};

export type WelcomeOffer = {
  summary?: string | null;
  estimatedValueCad?: number | null;
} | null;

export type CatalogCard = {
  id: string;
  name: string;
  issuer: string;
  annual_fee: number;
  point_currency: string;
  reward_categories: RewardCategory[];
  welcome_offer: WelcomeOffer;
  network: string | null;
  tier: string | null;
  last_verified: string;
  captured_at: string;
  verified_at: string | null;
  status: CatalogStatus;
  image_url: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  image_rights_status: AssetRightsStatus;
  reviewed_by: string | null;
};

export const CARD_COLUMNS =
  "id, name, issuer, annual_fee, point_currency, reward_categories, welcome_offer, network, tier, last_verified, captured_at, verified_at, status, image_url, image_alt, image_source_url, image_rights_status, reviewed_by";

export const CARD_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "stale", label: "Stale" },
  { value: "rejected", label: "Rejected" },
] as const;

export type CardStatusFilter = (typeof CARD_STATUS_FILTERS)[number]["value"];

export const CARDS_PAGE_SIZE = 20;

/** List row: catalog card plus console-only badges. */
export type CatalogCardListItem = CatalogCard & {
  pending_change: boolean;
  has_crawl_source: boolean;
};

export type CardAuditEntry = {
  id: string;
  actor_email: string;
  action: string;
  at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export const CARD_AUDIT_COLUMNS = "id, actor_email, action, at, before, after";

/** Field quote from the latest approved finding for this card (when present). */
export type FieldSource = {
  quote: string | null;
  label: string;
};
