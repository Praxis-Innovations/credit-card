export const SOURCE_STATUSES = ["active", "paused", "not_set_up", "blocked"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SCHEDULES = ["monthly", "manual"] as const;
export type Schedule = (typeof SCHEDULES)[number];

export type RobotsStatus = "allowed" | "disallowed" | "unreachable";

export type CrawlSource = {
  id: string;
  issuer_name: string;
  compare_url: string | null;
  url_pattern: string | null;
  schedule: Schedule;
  status: SourceStatus;
  robots_status: RobotsStatus | null;
  robots_checked_at: string | null;
  last_crawled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveredCardUrl = {
  id: string;
  source_id: string;
  card_name: string;
  product_url: string;
  first_seen_at: string;
  last_fetched_at: string | null;
  http_status: number | null;
  linked_card_id: string | null;
  included: boolean;
};

export type SourceRow = CrawlSource & {
  urls: DiscoveredCardUrl[];
  /** Verified catalog cards for this issuer, shown until the crawler finds pages. */
  catalogCount: number;
};

export const CRAWL_SOURCE_COLUMNS =
  "id, issuer_name, compare_url, url_pattern, schedule, status, robots_status, robots_checked_at, last_crawled_at, notes, created_at, updated_at";
