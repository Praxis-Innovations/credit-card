import { describe, expect, it } from "vitest";
import { canonicalUrl, cleanPage } from "./clean";

const PAGE = "https://www.bank.example/ca/en/credit-cards/compare.html";

const html = (body: string, htmlClass = "") => `<!doctype html>
<html class="${htmlClass}"><head><title> Compare  cards </title><style>.x{}</style></head>
<body>${body}</body></html>`;

describe("cleanPage text", () => {
  it("keeps main content and drops nav, page header/footer, scripts, media and cookie banners", () => {
    const { text, title } = cleanPage(
      html(`
        <header id="site-header"><a href="/">Bank home</a> Sign in</header>
        <nav><a href="/x">Mega menu card link</a></nav>
        <div id="onetrust-consent-sdk">We use cookies. Accept all</div>
        <div class="cookie-banner">Cookie settings</div>
        <main>
          <h1>Gold Card</h1>
          <script>window.track("x")</script>
          <img src="/card.png" alt="card art">
          <p>Annual fee: $120</p>
          <svg><text>icon</text></svg>
        </main>
        <footer>© Bank 2026 Legal</footer>`),
      PAGE,
    );
    expect(title).toBe("Compare cards");
    expect(text).toBe("Gold Card\n\nAnnual fee: $120");
  });

  it("does not drop the page when <html> carries a feature-detection class like `cookies`", () => {
    const { text } = cleanPage(html("<main><p>Earn 5 points</p></main>", "js cookies no-touch"), PAGE);
    expect(text).toBe("Earn 5 points");
  });

  it("keeps a <header> inside main (card hero) and collapsed accordion panels", () => {
    const { text } = cleanPage(
      html(`<main>
        <header><h1>Passport Visa Infinite Card</h1></header>
        <button aria-expanded="false">Rates and fees</button>
        <div hidden><p>Purchase interest rate 20.99%</p></div>
        <details><summary>Insurance</summary><p>Travel medical up to $2,000,000</p></details>
      </main>`),
      PAGE,
    );
    expect(text).toContain("Passport Visa Infinite Card");
    expect(text).toContain("Purchase interest rate 20.99%");
    expect(text).toContain("Travel medical up to $2,000,000");
  });

  it("renders lists and tables as lines and normalises whitespace", () => {
    const { text } = cleanPage(
      html(`<main>
        <ul><li>5x&nbsp;points   on groceries</li><li>1x points elsewhere</li></ul>
        <table><tr><th>Annual fee</th><td>$120</td></tr><tr><th>Cash advance</th><td>22.99%</td></tr></table>
      </main>`),
      PAGE,
    );
    expect(text).toBe("- 5x points on groceries\n- 1x points elsewhere\n\nAnnual fee | $120\nCash advance | 22.99%");
  });

  it("drops superscript footnote and trademark markers but keeps real superscript text", () => {
    const { text } = cleanPage(
      html(`<main><p>Scene+<sup>TM</sup> Visa<sup>®*</sup> Card: earn 2 points<sup>3</sup> per $1<sup>Δ</sup>. 1<sup>st</sup> year free.</p></main>`),
      PAGE,
    );
    expect(text).toBe("Scene+ Visa Card: earn 2 points per $1. 1st year free.");
  });

  it("drops adjacent duplicate lines from responsive markup", () => {
    const { text } = cleanPage(html("<main><p>Annual fee $0</p><p>Annual fee $0</p><p>Other</p></main>"), PAGE);
    expect(text).toBe("Annual fee $0\n\nOther");
  });

  it("falls back to <body> when there is no <main>", () => {
    const { text } = cleanPage(html("<div><p>Body only</p></div><footer>f</footer>"), PAGE);
    expect(text).toBe("Body only");
  });
});

describe("cleanPage links", () => {
  it("returns same-site links only, absolute, deduped, without hash or tracking params", () => {
    const { links } = cleanPage(
      html(`<main>
        <a href="/ca/en/credit-cards/visa/gold.html#rates">Gold card</a>
        <a href="https://bank.example/ca/en/credit-cards/visa/gold.html?utm_source=x">Learn more</a>
        <a href="https://other.example/card.html">Elsewhere</a>
        <a href="/docs/terms.pdf">Terms PDF</a>
        <a href="mailto:x@bank.example">Mail</a>
        <a href="${PAGE}">This page</a>
        <a href="/ca/en/credit-cards/visa/plain.html" aria-label="Plain card"></a>
      </main>`),
      PAGE,
    );
    expect(links).toEqual([
      { url: "https://www.bank.example/ca/en/credit-cards/visa/gold.html", text: "Gold card" },
      { url: "https://bank.example/ca/en/credit-cards/visa/gold.html", text: "Learn more" },
      { url: "https://www.bank.example/ca/en/credit-cards/visa/plain.html", text: "Plain card" },
    ]);
  });

  it("ignores links in nav and falls back to body links when main has none", () => {
    const { links } = cleanPage(
      html(`<nav><a href="/nav-card.html">Nav</a></nav><main><p>No links</p></main><div><a href="/x/card.html">Card</a></div>`),
      PAGE,
    );
    expect(links.map((l) => l.url)).toEqual(["https://www.bank.example/x/card.html"]);
  });
});

describe("canonicalUrl", () => {
  it("rejects non-http schemes and garbage", () => {
    expect(canonicalUrl("javascript:alert(1)", PAGE)).toBeNull();
    expect(canonicalUrl("http://[bad", undefined)).toBeNull();
    expect(canonicalUrl("/a?b=1&utm_medium=x#c", PAGE)).toBe("https://www.bank.example/a?b=1");
  });
});
