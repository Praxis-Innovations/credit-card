export const CRAWL_RUN_STATUSES = ["requested", "running", "done", "failed"] as const;
export type CrawlRunStatus = (typeof CRAWL_RUN_STATUSES)[number];

export type CrawlRun = {
  id: string;
  source_id: string | null;
  source_scope: string;
  trigger: string;
  status: CrawlRunStatus;
  requested_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

export const CRAWL_RUN_COLUMNS =
  "id, source_id, source_scope, trigger, status, requested_by, created_at, started_at, finished_at, error";

/** Scope value for requesting every active issuer. */
export const ALL_ACTIVE_SCOPE = "__all_active__";

export const GITHUB_ACTIONS_CRAWLER_URL =
  "https://github.com/Praxis-Innovations/credit-card/actions/workflows/crawler.yml";
