import robotsParser from "robots-parser";
import { USER_AGENT } from "./sources";

const cache = new Map<string, ReturnType<typeof robotsParser> | null>();

function robotsUrlFor(pageUrl: string): string {
  const u = new URL(pageUrl);
  return `${u.origin}/robots.txt`;
}

/**
 * Returns true when USER_AGENT is allowed to fetch `pageUrl` per robots.txt.
 * Fail-open on robots fetch errors (log-friendly null → allow with caveat),
 * but fail-closed when robots.txt explicitly Disallows the path.
 */
export async function isAllowedByRobots(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ allowed: boolean; checked: boolean; detail?: string }> {
  const robotsUrl = robotsUrlFor(pageUrl);
  let parser = cache.get(robotsUrl);

  if (parser === undefined) {
    try {
      const res = await fetchImpl(robotsUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/plain,*/*" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        cache.set(robotsUrl, null);
        return {
          allowed: true,
          checked: false,
          detail: `robots.txt HTTP ${res.status}; proceeding cautiously`,
        };
      }
      const body = await res.text();
      parser = robotsParser(robotsUrl, body);
      cache.set(robotsUrl, parser);
    } catch (err) {
      cache.set(robotsUrl, null);
      return {
        allowed: true,
        checked: false,
        detail: `robots.txt unreachable (${err instanceof Error ? err.message : String(err)}); proceeding cautiously`,
      };
    }
  }

  if (parser === null) {
    return { allowed: true, checked: false, detail: "no robots.txt cached" };
  }

  const allowed = parser.isAllowed(pageUrl, USER_AGENT) !== false;
  return {
    allowed,
    checked: true,
    detail: allowed ? undefined : `Disallow for ${USER_AGENT}`,
  };
}

/** Test helper — clear robots cache between cases. */
export function clearRobotsCache(): void {
  cache.clear();
}
