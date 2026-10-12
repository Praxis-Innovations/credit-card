import { describe, expect, it, vi } from "vitest";
import { checkRobotsTxt, isPrivateAddress, NORTHTAP_USER_AGENT } from "./robots";

const COMPARE = "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html";
const publicHost = async () => ["23.45.67.89"];

function fetchReturning(...responses: Response[]) {
  return vi.fn(async () => responses.shift()!) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("checkRobotsTxt", () => {
  it("fetches the origin's robots.txt with the NorthTap user-agent and a timeout", async () => {
    const fetch = fetchReturning(new Response("User-agent: *\nDisallow: /private/\n"));
    const res = await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost });
    expect(res).toMatchObject({ status: "allowed", robotsUrl: "https://www.scotiabank.com/robots.txt" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://www.scotiabank.com/robots.txt");
    expect(init.headers["User-Agent"]).toBe(NORTHTAP_USER_AGENT);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("manual");
  });

  it("reports disallowed when rules for NorthTap block the compare page", async () => {
    const fetch = fetchReturning(
      new Response("User-agent: *\nAllow: /\n\nUser-agent: NorthTapDataPipeline\nDisallow: /ca/en/personal/\n"),
    );
    expect((await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost })).status).toBe("disallowed");
  });

  it("treats a missing robots.txt (4xx) as allowed", async () => {
    const fetch = fetchReturning(new Response("nope", { status: 404 }));
    const res = await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost });
    expect(res.status).toBe("allowed");
    expect(res.detail).toMatch(/404/);
  });

  it("treats a server error as unreachable", async () => {
    const fetch = fetchReturning(new Response("down", { status: 503 }));
    expect((await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost })).status).toBe("unreachable");
  });

  it("times out", async () => {
    const fetch = vi.fn(
      (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    ) as unknown as typeof globalThis.fetch;
    const res = await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost, timeoutMs: 20 });
    expect(res.status).toBe("unreachable");
    expect(res.detail).toMatch(/timed out/);
  });

  it("follows a same-site redirect", async () => {
    const fetch = fetchReturning(
      new Response(null, { status: 301, headers: { location: "https://scotiabank.com/robots.txt" } }),
      new Response("User-agent: *\nDisallow:\n"),
    );
    expect((await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost })).status).toBe("allowed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not follow a redirect off-site", async () => {
    const fetch = fetchReturning(
      new Response(null, { status: 302, headers: { location: "https://evil.example/robots.txt" } }),
    );
    const res = await checkRobotsTxt(COMPARE, { fetch, resolveHost: publicHost });
    expect(res.status).toBe("unreachable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never fetches a host that resolves to a private address", async () => {
    const fetch = fetchReturning(new Response(""));
    const res = await checkRobotsTxt(COMPARE, { fetch, resolveHost: async () => ["10.0.0.5"] });
    expect(res.status).toBe("unreachable");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "0.0.0.0"])(
    "flags %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["23.45.67.89", "8.8.8.8", "2606:4700::1111"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
