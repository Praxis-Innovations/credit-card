import {
  FETCH_TIMEOUT_MS,
  PER_HOST_DELAY_MS,
  USER_AGENT,
} from "./sources";
import { isAllowedByRobots } from "./robots";
import type { CrawlSource, FetchOutcome, SourceAttempt } from "./types";

export interface FetchedPage {
  attempt: SourceAttempt;
  html?: string;
}

const lastHostFetchAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectHostBudget(url: string): Promise<void> {
  const host = new URL(url).host;
  const last = lastHostFetchAt.get(host) ?? 0;
  const wait = PER_HOST_DELAY_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastHostFetchAt.set(host, Date.now());
}

/**
 * Fetch a single public page with robots check, per-host delay, and timeout.
 * Never follows into authenticated areas — caller must only pass public URLs.
 */
export async function fetchSource(
  source: CrawlSource,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedPage> {
  const capturedAt = new Date().toISOString();
  const base: Omit<SourceAttempt, "outcome" | "robotsChecked"> & {
    robotsChecked: boolean;
  } = {
    sourceId: source.id,
    url: source.url,
    issuer: source.issuer,
    kind: source.kind,
    capturedAt,
    robotsChecked: false,
  };

  const robots = await isAllowedByRobots(source.url, fetchImpl);
  base.robotsChecked = robots.checked;

  if (!robots.allowed) {
    return {
      attempt: {
        ...base,
        outcome: "robots_disallowed",
        error: robots.detail ?? "robots.txt Disallow",
      },
    };
  }

  await respectHostBudget(source.url);

  try {
    const res = await fetchImpl(source.url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const contentType = res.headers.get("content-type") ?? undefined;
    if (!res.ok) {
      return {
        attempt: {
          ...base,
          outcome: "http_error",
          httpStatus: res.status,
          contentType,
          error: robots.detail,
        },
      };
    }

    const html = await res.text();
    if (!html.trim()) {
      return {
        attempt: {
          ...base,
          outcome: "empty_body",
          httpStatus: res.status,
          contentType,
          bytes: 0,
        },
      };
    }

    return {
      attempt: {
        ...base,
        outcome: "ok" satisfies FetchOutcome,
        httpStatus: res.status,
        contentType,
        bytes: Buffer.byteLength(html, "utf8"),
        error: robots.detail,
      },
      html,
    };
  } catch (err) {
    return {
      attempt: {
        ...base,
        outcome: "network_error",
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** Reset host throttle state (tests). */
export function clearFetchBudget(): void {
  lastHostFetchAt.clear();
}
