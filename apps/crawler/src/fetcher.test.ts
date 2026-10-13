import { describe, expect, it, vi } from "vitest";
import { detectBlock, PoliteFetcher, type LoadedPage, type PageLoader } from "./fetcher";
import type { RobotsVerdict } from "./robots";

const OK_HTML = "<html><head><title>Gold Card</title></head><body><main>Annual fee $120</main></body></html>";

function setup(responses: Array<LoadedPage | Error>, verdict: RobotsVerdict = { allowed: true, status: "allowed", detail: "" }) {
  let clock = 0;
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const queue = [...responses];
  const loader: PageLoader = {
    load: vi.fn(async (url: string) => {
      const next = queue.shift();
      if (!next) throw new Error(`unexpected load ${url}`);
      if (next instanceof Error) throw next;
      return next;
    }),
    close: async () => {},
  };
  const robots = { check: vi.fn(async () => verdict) };
  const fetcher = new PoliteFetcher(loader, robots, { sleep, now: () => clock, random: () => 0.5 });
  return { fetcher, loader, robots, sleep };
}

const page = (status: number, html = OK_HTML, finalUrl = "https://bank.example/a"): LoadedPage => ({ status, html, finalUrl });

describe("PoliteFetcher", () => {
  it("skips robots-disallowed URLs without loading them", async () => {
    const { fetcher, loader } = setup([], { allowed: false, status: "disallowed", detail: "robots.txt disallows /a" });
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "robots_disallowed", attempts: 0 });
    expect(loader.load).not.toHaveBeenCalled();
  });

  it("waits 3-5 s between requests to the same host and not before the first", async () => {
    const { fetcher, sleep } = setup([page(200), page(200, OK_HTML, "https://bank.example/b"), page(200, OK_HTML, "https://other.example/c")]);
    await fetcher.fetch("https://bank.example/a");
    expect(sleep).not.toHaveBeenCalled();
    await fetcher.fetch("https://bank.example/b");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]![0]).toBe(4000);
    await fetcher.fetch("https://other.example/c");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each([403, 429])("treats HTTP %i as blocked and never retries", async (status) => {
    const { fetcher, loader } = setup([page(status), page(200)]);
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "blocked", attempts: 1 });
    expect(loader.load).toHaveBeenCalledTimes(1);
  });

  it("treats a CAPTCHA / challenge page as blocked", async () => {
    const challenge = `<html><head><title>Just a moment...</title></head><body><div class="cf-challenge"></div></body></html>`;
    const { fetcher } = setup([page(200, challenge)]);
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("retries network errors and 5xx at most twice", async () => {
    const { fetcher, loader } = setup([new Error("net::ERR_TIMED_OUT"), page(503), page(502)]);
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "http_error", attempts: 3 });
    expect(loader.load).toHaveBeenCalledTimes(3);
  });

  it("succeeds on a retry", async () => {
    const { fetcher } = setup([new Error("net::ERR_CONNECTION_RESET"), page(200)]);
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: true, status: 200, attempts: 2 });
  });

  it("does not retry a 404", async () => {
    const { fetcher, loader } = setup([page(404), page(200)]);
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "http_error", detail: "HTTP 404" });
    expect(loader.load).toHaveBeenCalledTimes(1);
  });

  it("re-checks robots when redirected", async () => {
    const { fetcher, robots } = setup([page(200, OK_HTML, "https://bank.example/rates/x")]);
    robots.check
      .mockResolvedValueOnce({ allowed: true, status: "allowed", detail: "" })
      .mockResolvedValueOnce({ allowed: false, status: "disallowed", detail: "robots.txt disallows /rates/x" });
    expect(await fetcher.fetch("https://bank.example/a")).toMatchObject({ ok: false, reason: "robots_disallowed" });
  });
});

describe("detectBlock", () => {
  it("does not flag a normal page that merely includes a reCAPTCHA script", () => {
    const html = `<html><head><title>Gold Card</title><script src="https://www.google.com/recaptcha/api.js"></script></head>
      <body><div class="g-recaptcha"></div>${"<p>Long real content about the card.</p>".repeat(200)}</body></html>`;
    expect(detectBlock(200, html)).toBeNull();
  });
});
