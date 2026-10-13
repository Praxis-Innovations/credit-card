import { MAX_DELAY_MS, MAX_RETRIES, MIN_DELAY_MS } from "./config";
import type { RobotsGate } from "./robots";
import type { SkipReason } from "./types";

export interface LoadedPage {
  status: number;
  finalUrl: string;
  html: string;
}

/** Renders one URL. The Playwright implementation lives in browser.ts. */
export interface PageLoader {
  load(url: string): Promise<LoadedPage>;
  close(): Promise<void>;
}

export type FetchResult =
  | { ok: true; url: string; finalUrl: string; status: number; html: string; attempts: number }
  | { ok: false; url: string; reason: SkipReason; detail: string; status?: number; attempts: number };

export interface FetcherOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  log?: (msg: string) => void;
}

const BLOCK_TITLE =
  /(access denied|attention required|just a moment|request unsuccessful|pardon our interruption|are you a robot|security check|bot detection|unusual traffic)/i;
const CAPTCHA_MARKUP = /(g-recaptcha|h-captcha|hcaptcha|cf-challenge|challenge-platform|captcha-delivery|px-captcha|_Incapsula_Resource)/i;

/** True when the response is a refusal or a bot challenge rather than the page. We never try to get past it. */
export function detectBlock(status: number, html: string): string | null {
  if (status === 403 || status === 429) return `HTTP ${status}`;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  if (BLOCK_TITLE.test(title)) return `challenge page ("${title.trim().slice(0, 60)}")`;
  const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ");
  if (CAPTCHA_MARKUP.test(html) && visible.length < 3000) return "CAPTCHA challenge";
  return null;
}

export class PoliteFetcher {
  private readonly lastRequestAt = new Map<string, number>();
  private readonly opts: Required<FetcherOptions>;

  constructor(
    private readonly loader: PageLoader,
    private readonly robots: Pick<RobotsGate, "check">,
    options: FetcherOptions = {},
  ) {
    this.opts = {
      minDelayMs: MIN_DELAY_MS,
      maxDelayMs: MAX_DELAY_MS,
      maxRetries: MAX_RETRIES,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      random: Math.random,
      now: Date.now,
      log: () => {},
      ...options,
    };
  }

  private async waitTurn(host: string): Promise<void> {
    const last = this.lastRequestAt.get(host);
    if (last !== undefined) {
      const { minDelayMs, maxDelayMs } = this.opts;
      const gap = minDelayMs + this.opts.random() * (maxDelayMs - minDelayMs);
      const wait = gap - (this.opts.now() - last);
      if (wait > 0) await this.opts.sleep(wait);
    }
    this.lastRequestAt.set(host, this.opts.now());
  }

  async fetch(url: string): Promise<FetchResult> {
    const verdict = await this.robots.check(url);
    if (!verdict.allowed) {
      const reason: SkipReason =
        verdict.status === "disallowed" ? "robots_disallowed" : verdict.status === "blocked" ? "blocked" : "robots_unreachable";
      this.opts.log(`skip ${url}: ${verdict.detail}`);
      return { ok: false, url, reason, detail: verdict.detail, attempts: 0 };
    }

    const host = new URL(url).host;
    let lastError = "";
    for (let attempt = 1; attempt <= this.opts.maxRetries + 1; attempt++) {
      await this.waitTurn(host);
      let page: LoadedPage;
      try {
        page = await this.loader.load(url);
      } catch (err) {
        lastError = err instanceof Error ? err.message.split("\n")[0]! : String(err);
        this.opts.log(`attempt ${attempt} failed for ${url}: ${lastError}`);
        continue;
      }

      const block = detectBlock(page.status, page.html);
      if (block) {
        this.opts.log(`blocked at ${url}: ${block} — skipping, not retrying`);
        return { ok: false, url, reason: "blocked", detail: block, status: page.status, attempts: attempt };
      }
      if (page.status >= 500) {
        lastError = `HTTP ${page.status}`;
        this.opts.log(`attempt ${attempt} got ${lastError} for ${url}`);
        continue;
      }
      if (page.status >= 400) {
        return { ok: false, url, reason: "http_error", detail: `HTTP ${page.status}`, status: page.status, attempts: attempt };
      }
      if (page.finalUrl !== url) {
        const redirected = await this.robots.check(page.finalUrl);
        if (!redirected.allowed) {
          return { ok: false, url, reason: "robots_disallowed", detail: `redirected to ${page.finalUrl}: ${redirected.detail}`, attempts: attempt };
        }
      }
      if (!page.html.trim()) {
        return { ok: false, url, reason: "empty_page", detail: "empty response body", status: page.status, attempts: attempt };
      }
      return { ok: true, url, finalUrl: page.finalUrl, status: page.status, html: page.html, attempts: attempt };
    }
    const reason: SkipReason = lastError.startsWith("HTTP ") ? "http_error" : "network_error";
    return { ok: false, url, reason, detail: `${lastError} after ${this.opts.maxRetries + 1} attempts`, attempts: this.opts.maxRetries + 1 };
  }
}
