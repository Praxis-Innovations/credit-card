import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import robotsParser from "robots-parser";
import { registrableDomain } from "./issuer-domains";
import type { RobotsStatus } from "./types";

/** Same product token as the crawler, so robots rules are checked for the bot that will obey them. */
export const NORTHTAP_USER_AGENT =
  "NorthTapDataPipeline/0.1 (+https://github.com/Praxis-Innovations; research; public pages only)";

export const ROBOTS_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
/** RFC 9309 asks crawlers to parse at least the first 500 KiB. */
const MAX_BYTES = 512 * 1024;

export type RobotsCheck = {
  status: RobotsStatus;
  robotsUrl: string;
  detail: string;
};

export type RobotsDeps = {
  fetch?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
};

async function defaultResolve(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return (
    ip === "::" ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80") ||
    ip.startsWith("ff")
  );
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, buf.length - offset);
    buf.set(slice, offset);
    offset += slice.length;
    if (offset >= buf.length) break;
  }
  return new TextDecoder().decode(buf);
}

/**
 * Fetches the compare page's origin robots.txt with the NorthTap user-agent
 * and decides whether the compare URL may be crawled (RFC 9309): 2xx is
 * parsed, 4xx means no rules (allowed), anything else is "unreachable", which
 * the crawler treats as disallowed. Redirects are followed only within the
 * same site, and never to a private address.
 */
export async function checkRobotsTxt(compareUrl: string, deps: RobotsDeps = {}): Promise<RobotsCheck> {
  const doFetch = deps.fetch ?? fetch;
  const resolveHost = deps.resolveHost ?? defaultResolve;
  const timeoutMs = deps.timeoutMs ?? ROBOTS_TIMEOUT_MS;

  const target = new URL(compareUrl);
  const robotsUrl = `${target.origin}/robots.txt`;
  const site = registrableDomain(target.hostname);
  const unreachable = (detail: string): RobotsCheck => ({ status: "unreachable", robotsUrl, detail });

  const signal = AbortSignal.timeout(timeoutMs);
  let next = robotsUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = new URL(next);
      if (url.protocol !== "https:" || url.port || registrableDomain(url.hostname) !== site) {
        return unreachable(`robots.txt redirects off-site to ${url.host}.`);
      }
      const addresses = await resolveHost(url.hostname);
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        return unreachable(`${url.hostname} does not resolve to a public address.`);
      }

      const res = await doFetch(url, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { "User-Agent": NORTHTAP_USER_AGENT, Accept: "text/plain,*/*;q=0.5" },
        cache: "no-store",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!location) return unreachable(`robots.txt returned HTTP ${res.status} with no location.`);
        next = new URL(location, url).toString();
        continue;
      }
      if (res.status >= 400 && res.status < 500) {
        await res.body?.cancel().catch(() => {});
        return {
          status: "allowed",
          robotsUrl,
          detail: `No robots.txt (HTTP ${res.status}), so the compare page may be crawled.`,
        };
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return unreachable(`robots.txt returned HTTP ${res.status}. The crawler treats this as disallowed.`);
      }

      const body = await readCapped(res);
      const allowed = robotsParser(robotsUrl, body).isAllowed(compareUrl, NORTHTAP_USER_AGENT);
      if (allowed === undefined) return unreachable("robots.txt could not be matched to the compare URL.");
      return allowed
        ? { status: "allowed", robotsUrl, detail: "robots.txt allows the compare page." }
        : { status: "disallowed", robotsUrl, detail: "robots.txt disallows the compare page for NorthTap." };
    }
    return unreachable("robots.txt redirected too many times.");
  } catch (err) {
    if (signal.aborted) return unreachable(`robots.txt timed out after ${Math.round(timeoutMs / 1000)} s.`);
    return unreachable(`Could not fetch robots.txt: ${(err as Error).message}`);
  }
}
