import { numberInQuote } from "./checks";
import type { CardExtraction, EarnRate, Quoted } from "./extract/schema";

/** How far (in lines) we look for a table-rate cell or nearby number. */
const MAX_LINE_DISTANCE = 4;

/**
 * Short cleaned-page cells that are just a rate: "6 points", "22.99%", "Up to 4 points".
 * Used to pair a description quote with the rate sitting in the cell above it.
 */
export function isRateCell(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 48) return false;
  return /^(up to\s+)?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(%|points?|x|\/year|\/mo(?:nth)?)?$/i.test(t);
}

function lineStartsOf(page: string): number[] {
  const starts = [0];
  for (let i = 0; i < page.length; i++) {
    if (page[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineIndex(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function lineAt(page: string, starts: number[], i: number): string {
  const a = starts[i]!;
  const b = i + 1 < starts.length ? starts[i + 1]! : page.length;
  return page.slice(a, b);
}

function sliceLines(page: string, starts: number[], from: number, to: number): string {
  const a = starts[from]!;
  const b = to + 1 < starts.length ? starts[to + 1]! : page.length;
  return page.slice(a, b).trim();
}

/** Rate cell above a description (Scotiabank table layout). Pair even on mismatch. */
function rateCellAbove(page: string, starts: number[], qTop: number): number | null {
  for (let dist = 1; dist <= MAX_LINE_DISTANCE; dist++) {
    const i = qTop - dist;
    if (i < 0) return null;
    const line = lineAt(page, starts, i);
    if (!line.trim()) continue;
    if (isRateCell(line)) return i;
  }
  return null;
}

/** Nearest line outside [qTop, qBot] that contains `value`; prefer above on ties. */
function nearestLineWithNumber(
  page: string,
  starts: number[],
  qTop: number,
  qBot: number,
  value: number,
): number | null {
  let best: { dist: number; above: boolean; i: number } | null = null;
  for (let i = 0; i < starts.length; i++) {
    if (i >= qTop && i <= qBot) continue;
    if (!numberInQuote(value, lineAt(page, starts, i))) continue;
    const dist = i < qTop ? qTop - i : i - qBot;
    if (dist > MAX_LINE_DISTANCE) continue;
    const above = i < qTop;
    if (!best || dist < best.dist || (dist === best.dist && above && !best.above)) {
      best = { dist, above, i };
    }
  }
  return best?.i ?? null;
}

/**
 * Widen a quote so it contains `value`, by growing to the table row (rate cell
 * above the description) or the nearest nearby line with the number.
 * Returns the original quote when the number is already present, or when no
 * nearby span contains it — callers then flag the field honestly.
 */
export function widenQuoteToContainNumber(quote: string, value: number, pageText: string): string {
  if (numberInQuote(value, quote)) return quote;

  const start = pageText.indexOf(quote);
  if (start < 0) return quote;
  const starts = lineStartsOf(pageText);
  const qTop = lineIndex(starts, start);
  const qBot = lineIndex(starts, start + quote.length - 1);

  const rateLine = rateCellAbove(pageText, starts, qTop);
  if (rateLine !== null) return sliceLines(pageText, starts, rateLine, qBot);

  const near = nearestLineWithNumber(pageText, starts, qTop, qBot, value);
  if (near === null) return quote;
  return sliceLines(pageText, starts, Math.min(near, qTop), Math.max(near, qBot));
}

function widenQuotedNumber<T>(field: Quoted<T> | null, value: number | null | undefined, pageText: string): Quoted<T> | null {
  if (!field || value === null || value === undefined) return field;
  const quote = widenQuoteToContainNumber(field.quote, value, pageText);
  return quote === field.quote ? field : { ...field, quote };
}

function widenEarnRate(rate: EarnRate, pageText: string): EarnRate {
  const quote = widenQuoteToContainNumber(rate.quote, rate.rate, pageText);
  return quote === rate.quote ? rate : { ...rate, quote };
}

/**
 * Post-extraction quote selection: keep Claude's span when it already holds the
 * number; otherwise widen to the sentence / table row on the page. Does not
 * change values — only the quote text used for checks and review.
 */
export function selectQuoteSpans(extraction: CardExtraction, pageText: string): CardExtraction {
  return {
    ...extraction,
    balance_transfer_apr: widenQuotedNumber(
      extraction.balance_transfer_apr,
      extraction.balance_transfer_apr?.value,
      pageText,
    ),
    earn_rates: extraction.earn_rates.map((r) => widenEarnRate(r, pageText)),
  };
}
