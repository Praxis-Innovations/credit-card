export const USER_AGENT = "NorthTapBot/0.1 (+contact: info.praxisinnovations@gmail.com)";
/** robots.txt group token matched against `User-agent:` lines. */
export const ROBOTS_AGENT = "NorthTapBot";

export const MIN_DELAY_MS = 3_000;
export const MAX_DELAY_MS = 5_000;
export const MAX_RETRIES = 2;
export const NAV_TIMEOUT_MS = 30_000;
export const ROBOTS_TIMEOUT_MS = 10_000;

/** Upper bounds on text sent to Claude; pages beyond this are truncated (and logged). */
export const MAX_COMPARE_TEXT_CHARS = 40_000;
export const MAX_CARD_TEXT_CHARS = 60_000;
export const MAX_COMPARE_LINKS = 400;

export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** USD per million tokens. Override with CRAWLER_PRICE_*_PER_MTOK when list prices change. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function pricingFor(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): { input: number; output: number } {
  const base = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL]!;
  const input = Number(env.CRAWLER_PRICE_INPUT_PER_MTOK);
  const output = Number(env.CRAWLER_PRICE_OUTPUT_PER_MTOK);
  return {
    input: Number.isFinite(input) && input > 0 ? input : base.input,
    output: Number.isFinite(output) && output > 0 ? output : base.output,
  };
}

export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
  env: NodeJS.ProcessEnv = process.env,
): number {
  const p = pricingFor(model, env);
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}

/**
 * Used only by `--dry-run` when the database is unreachable or not migrated.
 * Mirrors crawl_sources seeds (Scotiabank in admin_console; others in CR4).
 */
export const FALLBACK_SOURCES = [
  {
    id: null,
    issuer_name: "Scotiabank",
    compare_url: "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "RBC",
    compare_url: "https://www.rbcroyalbank.com/credit-cards/all-credit-cards.html",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "TD",
    compare_url: "https://www.td.com/ca/en/personal-banking/products/credit-cards/compare-cards",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "CIBC",
    compare_url: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards.html",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "National Bank",
    compare_url: "https://www.nbc.ca/personal/mastercard-credit-cards.html",
    url_pattern: "/mastercard-credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "American Express",
    compare_url: "https://www.americanexpress.com/ca/en/credit-cards/",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "BMO",
    compare_url: "https://www.bmo.com/main/personal/credit-cards/all-cards/",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "Tangerine",
    compare_url: "https://www.tangerine.ca/en/personal/spend/credit-cards",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "Desjardins",
    compare_url: "https://www.desjardins.com/en/credit-cards.html",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "PC Financial",
    compare_url: "https://www.pcfinancial.ca/en/credit-cards/",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "Rogers",
    compare_url: "https://www.rogersbank.com/en/personal/credit-cards",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "Simplii",
    compare_url: "https://www.simplii.com/en/credit-cards.html",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "Canadian Tire",
    compare_url: "https://www.triangle.com/en/credit-cards.html",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "MBNA",
    compare_url: "https://www.mbna.ca/en/credit-cards/",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "Neo",
    compare_url: "https://www.neofinancial.com/credit-cards",
    url_pattern: "/credit-cards/",
    status: "active",
  },
  {
    id: null,
    issuer_name: "HSBC",
    compare_url: "https://www.hsbc.ca/credit-cards/",
    url_pattern: "/credit-cards/",
    status: "blocked",
  },
  {
    id: null,
    issuer_name: "Brim",
    compare_url: "https://brimfinancial.com/personal-credit-cards",
    url_pattern: "/credit-cards",
    status: "active",
  },
] as const;
