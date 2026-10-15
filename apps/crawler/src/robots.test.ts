import { describe, expect, it, vi } from "vitest";
import { USER_AGENT } from "./config";
import { RobotsGate } from "./robots";

function fetchReturning(res: Response | Error) {
  return vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res.clone();
  });
}

const page = (path: string) => `https://www.bank.example${path}`;

describe("RobotsGate", () => {
  it("obeys Disallow rules for all agents and sends our user agent", async () => {
    const fetchImpl = fetchReturning(new Response("User-agent: *\nDisallow: /rates\n"));
    const gate = new RobotsGate(fetchImpl as typeof fetch);
    expect(await gate.check(page("/rates/today.html"))).toMatchObject({ allowed: false, status: "disallowed" });
    expect(await gate.check(page("/credit-cards/gold.html"))).toMatchObject({ allowed: true, status: "allowed" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.bank.example/robots.txt");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
  });

  it("obeys a group addressed to NorthTapBot specifically", async () => {
    const gate = new RobotsGate(
      fetchReturning(new Response("User-agent: NorthTapBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n")) as typeof fetch,
    );
    expect((await gate.check(page("/credit-cards/"))).allowed).toBe(false);
  });

  it("fetches robots.txt once per origin", async () => {
    const fetchImpl = fetchReturning(new Response("User-agent: *\nAllow: /\n"));
    const gate = new RobotsGate(fetchImpl as typeof fetch);
    await gate.check(page("/a"));
    await gate.check(page("/b"));
    await gate.check("https://other.example/c");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("treats a missing robots.txt (404) as allow-all", async () => {
    const gate = new RobotsGate(fetchReturning(new Response("nope", { status: 404 })) as typeof fetch);
    expect(await gate.check(page("/x"))).toMatchObject({ allowed: true, status: "no_robots" });
  });

  it.each([401, 403, 429])("treats robots.txt HTTP %i as a block", async (status) => {
    const gate = new RobotsGate(fetchReturning(new Response("", { status })) as typeof fetch);
    expect(await gate.check(page("/x"))).toMatchObject({ allowed: false, status: "blocked" });
  });

  it("treats 5xx and network errors as unreachable (full disallow)", async () => {
    const down = new RobotsGate(fetchReturning(new Response("", { status: 503 })) as typeof fetch);
    expect(await down.check(page("/x"))).toMatchObject({ allowed: false, status: "unreachable" });
    const offline = new RobotsGate(fetchReturning(new Error("ECONNRESET")) as typeof fetch);
    expect(await offline.check(page("/x"))).toMatchObject({ allowed: false, status: "unreachable" });
  });
});
