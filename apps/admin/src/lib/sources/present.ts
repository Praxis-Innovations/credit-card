import type { CrawlSource } from "./types";

export type PillTone = "ok" | "neutral" | "bad" | "warn";

export function statusPill(source: Pick<CrawlSource, "status" | "robots_status">): {
  label: string;
  tone: PillTone;
} {
  switch (source.status) {
    case "paused":
      return { label: "Paused", tone: "neutral" };
    case "not_set_up":
      return { label: "Not set up", tone: "warn" };
    case "blocked":
      return { label: "Blocked", tone: "bad" };
    case "active":
      switch (source.robots_status) {
        case "allowed":
          return { label: "Active", tone: "ok" };
        case "disallowed":
          return { label: "Active · robots disallow", tone: "bad" };
        case "unreachable":
          return { label: "Active · robots unreachable", tone: "warn" };
        default:
          return { label: "Active", tone: "ok" };
      }
  }
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Toronto",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

export function formatDate(iso: string | null, fallback = "Never"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : DATE_FORMAT.format(d);
}

export function formatDateTime(iso: string | null, fallback = "Never"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : DATE_TIME_FORMAT.format(d);
}

/** "https://www.td.com/ca/en/x" → "td.com/ca/en/x" for compact display. */
export function displayUrl(url: string): string {
  return url.replace(/^https:\/\//, "").replace(/^www\./, "");
}
