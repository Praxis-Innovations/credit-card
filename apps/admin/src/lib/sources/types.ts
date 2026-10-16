export const SOURCE_STATUSES = ["active", "paused", "not_set_up", "blocked"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export type CrawlSource = {
  id: string;
  issuer_name: string;
  compare_url: string | null;
  url_pattern: string | null;
  schedule: "monthly" | "manual";
  status: SourceStatus;
  robots_status: "allowed" | "disallowed" | "unreachable" | null;
  robots_checked_at: string | null;
  last_crawled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const CRAWL_SOURCE_COLUMNS =
  "id, issuer_name, compare_url, url_pattern, schedule, status, robots_status, robots_checked_at, last_crawled_at, notes, created_at, updated_at";

export const SOURCE_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "paused", label: "Paused" },
  { value: "not_set_up", label: "Not set up" },
] as const;

export type SourceStatusFilter = (typeof SOURCE_STATUS_FILTERS)[number]["value"];

export const SOURCES_PAGE_SIZE = 20;
