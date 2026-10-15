import robotsParser from "robots-parser";
import { ROBOTS_AGENT, ROBOTS_TIMEOUT_MS, USER_AGENT } from "./config";

/** RFC 9309: parse at least the first 500 KiB. */
const MAX_ROBOTS_BYTES = 512 * 1024;

export type RobotsVerdict =
  | { allowed: true; status: "allowed" | "no_robots"; detail: string }
  | { allowed: false; status: "disallowed" | "unreachable" | "blocked"; detail: string };

type Rules =
  | { kind: "parsed"; parser: ReturnType<typeof robotsParser> }
  | { kind: "allow_all"; detail: string }
  | { kind: "deny_all"; status: "unreachable" | "blocked"; detail: string };

/**
 * robots.txt gate, cached per origin for the life of one run.
 *
 * Policy (RFC 9309, conservative where it leaves room):
 * - 2xx: obey the rules for our product token (falls back to `*`).
 * - 404/410 and other 4xx: no robots.txt, everything allowed —
 *   except 401/403/429, which mean the site is refusing us, so we stop.
 * - 5xx, timeout or network error: unreachable, treat as full disallow.
 */
export class RobotsGate {
  private readonly cache = new Map<string, Promise<Rules>>();

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = ROBOTS_TIMEOUT_MS,
  ) {}

  async check(pageUrl: string): Promise<RobotsVerdict> {
    const robotsUrl = new URL("/robots.txt", pageUrl).toString();
    let rules = this.cache.get(robotsUrl);
    if (!rules) {
      rules = this.load(robotsUrl);
      this.cache.set(robotsUrl, rules);
    }
    const r = await rules;
    if (r.kind === "allow_all") return { allowed: true, status: "no_robots", detail: r.detail };
    if (r.kind === "deny_all") return { allowed: false, status: r.status, detail: r.detail };
    const allowed = r.parser.isAllowed(pageUrl, ROBOTS_AGENT);
    return allowed === false
      ? { allowed: false, status: "disallowed", detail: `robots.txt disallows ${new URL(pageUrl).pathname}` }
      : { allowed: true, status: "allowed", detail: "allowed by robots.txt" };
  }

  private async load(robotsUrl: string): Promise<Rules> {
    let res: Response;
    try {
      res = await this.fetchImpl(robotsUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/plain,*/*;q=0.5" },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      return {
        kind: "deny_all",
        status: "unreachable",
        detail: `robots.txt unreachable (${err instanceof Error ? err.message : String(err)})`,
      };
    }
    if (res.ok) {
      const body = (await res.text()).slice(0, MAX_ROBOTS_BYTES);
      return { kind: "parsed", parser: robotsParser(robotsUrl, body) };
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { kind: "deny_all", status: "blocked", detail: `robots.txt returned HTTP ${res.status}` };
    }
    if (res.status >= 400 && res.status < 500) {
      return { kind: "allow_all", detail: `no robots.txt (HTTP ${res.status})` };
    }
    return { kind: "deny_all", status: "unreachable", detail: `robots.txt returned HTTP ${res.status}` };
  }
}
