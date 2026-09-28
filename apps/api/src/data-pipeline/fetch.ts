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

export interface PoliteFetchOptions {
  accept: string;
  /** Conditional request validators from a previous download. */
  etag?: string | null;
  lastModified?: string | null;
  maxBytes?: number;
}

export type PoliteFetchResult =
  | {
      outcome: "ok";
      status: number;
      finalUrl: string;
      contentType: string | null;
      etag: string | null;
      lastModified: string | null;
      body: Uint8Array;
    }
  | { outcome: "not_modified"; status: 304; finalUrl: string }
  | {
      outcome:
        | "robots_disallowed"
        | "http_error"
        | "too_large"
        | "network_error";
      status?: number;
      error?: string;
    };

/**
 * Fetch any public URL (page or image) with the same robots check, per-host
 * delay, timeout and User-Agent as `fetchSource`. Sends If-None-Match /
 * If-Modified-Since when validators are given, so unchanged files are not
 * downloaded again.
 */
export async function politeFetch(
  url: string,
  opts: PoliteFetchOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<PoliteFetchResult> {
  const robots = await isAllowedByRobots(url, fetchImpl);
  if (!robots.allowed) {
    return { outcome: "robots_disallowed", error: robots.detail };
  }
  await respectHostBudget(url);

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: opts.accept,
    "Accept-Language": "en-CA,en;q=0.9",
  };
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  try {
    const res = await fetchImpl(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const finalUrl = res.url || url;
    if (res.status === 304) {
      return { outcome: "not_modified", status: 304, finalUrl };
    }
    if (!res.ok) return { outcome: "http_error", status: res.status };
    const body = new Uint8Array(await res.arrayBuffer());
    if (opts.maxBytes !== undefined && body.length > opts.maxBytes) {
      return {
        outcome: "too_large",
        status: res.status,
        error: `${body.length} bytes > ${opts.maxBytes}`,
      };
    }
    return {
      outcome: "ok",
      status: res.status,
      finalUrl,
      contentType: res.headers.get("content-type"),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      body,
    };
  } catch (err) {
    return {
      outcome: "network_error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Reset host throttle state (tests). */
export function clearFetchBudget(): void {
  lastHostFetchAt.clear();
}
