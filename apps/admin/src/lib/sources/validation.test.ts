import { describe, expect, it } from "vitest";
import { isIssuerDomain, registrableDomain } from "./issuer-domains";
import { validateCompareUrl, validateSourceInput, validateUrlPattern } from "./validation";

const base = { issuer_name: "Scotiabank", compare_url: "", url_pattern: "", schedule: "monthly", notes: "" };

describe("validateCompareUrl", () => {
  it.each([
    ["Scotiabank", "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html"],
    ["RBC", "https://www.rbcroyalbank.com/credit-cards/"],
    ["TD", "https://www.td.com/ca/en/personal-banking/products/credit-cards"],
    ["National Bank", "https://www.nbc.ca/en/personal/credit-cards.html"],
    ["american express", "https://www.americanexpress.com/en-ca/credit-cards/"],
    ["Koho", "https://www.koho.ca/credit-building/"],
    ["Wealthsimple", "https://www.wealthsimple.com/en-ca/credit-card"],
  ])("accepts %s → %s", (issuer, url) => {
    expect(validateCompareUrl(url, issuer)).toEqual({ ok: true, url });
  });

  it("drops the fragment", () => {
    expect(validateCompareUrl("https://www.td.com/cards#top", "TD")).toEqual({
      ok: true,
      url: "https://www.td.com/cards",
    });
  });

  it.each([
    ["not a URL", "Scotiabank", "scotiabank.com/cards", /full URL/],
    ["http", "Scotiabank", "http://www.scotiabank.com/cards", /https/],
    ["javascript:", "Scotiabank", "javascript:alert(1)", /https/],
    ["credentials", "Scotiabank", "https://user:pw@www.scotiabank.com/", /username or password/],
    ["a port", "Scotiabank", "https://www.scotiabank.com:8443/", /port/],
    ["an IPv4 address", "Scotiabank", "https://10.0.0.1/", /IP address/],
    ["an IPv6 address", "Scotiabank", "https://[::1]/", /IP address/],
    ["localhost", "Koho", "https://localhost/koho", /IP address|local/],
    ["an aggregator", "Scotiabank", "https://www.ratehub.ca/credit-cards/scotiabank", /scotiabank\.com/],
    ["a lookalike subdomain", "Scotiabank", "https://scotiabank.com.evil.example/", /scotiabank\.com/],
    ["a lookalike domain", "TD", "https://www.td.com-cards.example/", /td\.com/],
    ["another issuer's site", "TD", "https://www.rbcroyalbank.com/credit-cards/", /td\.com/],
    ["an unknown issuer on someone else's domain", "Koho", "https://koho.evil.example/", /own site/],
    ["a generic-word match only", "Home Trust Bank", "https://www.anybank.ca/", /own site/],
  ])("rejects %s", (_label, issuer, url, error) => {
    const res = validateCompareUrl(url, issuer);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(error);
  });
});

describe("issuer domains", () => {
  it.each([
    ["www.scotiabank.com", "scotiabank.com"],
    ["cards.td.com", "td.com"],
    ["www.example.co.uk", "example.co.uk"],
    ["nbc.ca", "nbc.ca"],
  ])("registrableDomain(%s) = %s", (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });

  it("accepts every listed domain and its subdomains for a known issuer", () => {
    expect(isIssuerDomain("www.rbc.com", "RBC")).toBe(true);
    expect(isIssuerDomain("rbcroyalbank.com", "rbc")).toBe(true);
    expect(isIssuerDomain("notrbc.com", "RBC")).toBe(false);
  });
});

describe("validateUrlPattern", () => {
  it.each(["", "/credit-cards/", "/en/personal/credit-cards/"])("accepts %j", (v) => {
    expect(validateUrlPattern(v).ok).toBe(true);
  });
  it.each(["credit-cards", "//evil.example/", "/with space/", "https://x.com/"])("rejects %j", (v) => {
    expect(validateUrlPattern(v).ok).toBe(false);
  });
});

describe("validateSourceInput", () => {
  it("normalizes a valid form", () => {
    const res = validateSourceInput({
      ...base,
      issuer_name: "  Scotiabank  ",
      compare_url: " https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html ",
      notes: "  ",
    });
    expect(res).toEqual({
      ok: true,
      data: {
        issuer_name: "Scotiabank",
        compare_url: "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html",
        url_pattern: null,
        schedule: "monthly",
        notes: null,
      },
    });
  });

  it("allows a blank compare URL (not set up yet)", () => {
    const res = validateSourceInput({ ...base, issuer_name: "Tangerine" });
    expect(res.ok && res.data.compare_url).toBeNull();
  });

  it("reports every invalid field", () => {
    const res = validateSourceInput({
      issuer_name: "x",
      compare_url: "http://example.com",
      url_pattern: "nope",
      schedule: "hourly",
      notes: "n".repeat(1001),
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && Object.keys(res.fieldErrors).sort()).toEqual(
      ["compare_url", "issuer_name", "notes", "schedule", "url_pattern"].sort(),
    );
  });

  it("rejects markup in the issuer name", () => {
    const res = validateSourceInput({ ...base, issuer_name: "<script>Bank" });
    expect(!res.ok && res.fieldErrors.issuer_name).toBeTruthy();
  });
});
