import type { CreditCard } from "../../schema";
import type { CrawlSource, StagingFact } from "../types";
import {
  htmlToText,
  makeFact,
  namesLooselyMatch,
  snippetAround,
} from "./html";

const FEE_NEAR_NAME =
  /([A-Za-z][A-Za-z0-9+®™© &\-/'’.]{2,60}?)\s+((?:Visa|Mastercard|American Express|Amex)(?:\s+(?:Infinite(?:\s+Privilege)?|World Elite|Platinum|Gold|Cash\s*Back|CashBack))?)\s[^.]{0,60}?Annual\s+Fee[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/gi;

const FEE_STANDALONE =
  /Annual\s+Fee[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/gi;

const EARN_RATE =
  /(?:earn|get|enjoy)\s+(?:up\s+to\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:%|points?|pts|Scene\+|Aeroplan|Avion|Aventura|AIR\s*MILES|TD\s*Rewards|BMO\s*Rewards)?\s*(?:back\s+)?(?:in\s+)?(?:points?\s+)?(?:per|\/|on)\s*(?:\$\s*1|dollar|net\s+purchase)?/gi;

const POINT_CURRENCY_HINTS: Array<{ re: RegExp; label: string }> = [
  { re: /\bScene\+/i, label: "Scene+" },
  { re: /\bAeroplan\b/i, label: "Aeroplan" },
  { re: /\bAvion\b/i, label: "RBC Avion" },
  { re: /\bAventura\b/i, label: "CIBC Aventura" },
  { re: /\bTD Rewards\b/i, label: "TD Rewards" },
  { re: /\bBMO Rewards\b/i, label: "BMO Rewards" },
  { re: /\bAIR\s*MILES\b/i, label: "AIR MILES" },
  { re: /\bWestJet\b/i, label: "WestJet" },
  { re: /\bMoi\b/i, label: "Moi" },
  { re: /\bcash\s*back\b/i, label: "cashback" },
];

/**
 * Extract card-oriented facts from a listing (or product) page.
 * Matching against the production catalog is done later in diff — here we
 * only record raw page signals, plus fee hits near known catalog names.
 */
export function extractCardFacts(input: {
  source: CrawlSource;
  html: string;
  capturedAt: string;
  catalogCards: CreditCard[];
}): StagingFact[] {
  const text = htmlToText(input.html);
  const facts: StagingFact[] = [];
  const seen = new Set<string>();
  const push = (f: StagingFact) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    facts.push(f);
  };

  const issuerCards = input.catalogCards.filter(
    (c) => c.issuer === input.source.issuer,
  );

  // 1) Catalog-guided: for each known card, if its name appears, capture
  //    nearby annual-fee and currency hints from the page.
  for (const card of issuerCards) {
    const nameIdx = text.toLowerCase().indexOf(
      card.name.toLowerCase().replace(/[®™]/g, ""),
    );
    // Also try shorter distinctive tokens
    let matchedAt = nameIdx;
    if (matchedAt < 0) {
      for (const c of issuerCards) {
        if (namesLooselyMatch(c.name, card.name) && text.toLowerCase().includes(
          normalizeLoose(c.name),
        )) {
          matchedAt = text.toLowerCase().indexOf(normalizeLoose(c.name));
          break;
        }
      }
    }

    const present = issuerCards.some((c) =>
      text.toLowerCase().includes(normalizeLoose(c.name)),
    );
    const thisPresent =
      matchedAt >= 0 ||
      text.toLowerCase().includes(normalizeLoose(card.name));

    if (!thisPresent && !present) continue;

    if (thisPresent) {
      push(
        makeFact({
          kind: "card_name",
          issuer: input.source.issuer,
          subject: card.name,
          rawValue: card.name,
          sourceUrl: input.source.url,
          capturedAt: input.capturedAt,
          context: snippetAround(
            text,
            Math.max(0, text.toLowerCase().indexOf(normalizeLoose(card.name))),
          ),
        }),
      );
    }

    // Fee near this card's name occurrence
    const idx = text.toLowerCase().indexOf(normalizeLoose(card.name));
    if (idx >= 0) {
      const window = text.slice(idx, idx + 220);
      const feeMatch = /Annual\s+Fee[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i.exec(
        window,
      );
      if (feeMatch) {
        push(
          makeFact({
            kind: "annual_fee",
            issuer: input.source.issuer,
            subject: card.name,
            rawValue: feeMatch[0],
            parsedNumber: Number(feeMatch[1]),
            sourceUrl: input.source.url,
            capturedAt: input.capturedAt,
            context: window.slice(0, 220),
          }),
        );
      }

      for (const hint of POINT_CURRENCY_HINTS) {
        if (hint.re.test(window) || hint.re.test(card.pointCurrency)) {
          // Only emit if the hint appears in the local window (page evidence)
          if (hint.re.test(window)) {
            push(
              makeFact({
                kind: "point_currency",
                issuer: input.source.issuer,
                subject: card.name,
                rawValue: hint.label,
                sourceUrl: input.source.url,
                capturedAt: input.capturedAt,
                context: window.slice(0, 220),
              }),
            );
          }
        }
      }
    }
  }

  // 2) Unguided fee+name pairs — potential NEW cards not in catalog
  FEE_NEAR_NAME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FEE_NEAR_NAME.exec(text)) !== null) {
    const rawSubject = m[1];
    const network = m[2];
    const feeAmount = m[3];
    if (!rawSubject || !network || !feeAmount) continue;
    const subject = cleanCardSubject(`${rawSubject} ${network}`);
    if (!subject || subject.length < 8) continue;
    if (isNoiseSubject(subject)) continue;
    if (!looksLikeCardProduct(subject)) continue;

    push(
      makeFact({
        kind: "card_name",
        issuer: input.source.issuer,
        subject,
        rawValue: subject,
        sourceUrl: input.source.url,
        capturedAt: input.capturedAt,
        context: snippetAround(text, m.index),
      }),
    );
    push(
      makeFact({
        kind: "annual_fee",
        issuer: input.source.issuer,
        subject,
        rawValue: `Annual Fee $${feeAmount}`,
        parsedNumber: Number(feeAmount),
        sourceUrl: input.source.url,
        capturedAt: input.capturedAt,
        context: snippetAround(text, m.index),
      }),
    );
  }

  // 3) Standalone fee mentions (weak) — only if few guided fees found
  const feeFacts = facts.filter((f) => f.kind === "annual_fee");
  if (feeFacts.length < 2) {
    FEE_STANDALONE.lastIndex = 0;
    while ((m = FEE_STANDALONE.exec(text)) !== null) {
      push(
        makeFact({
          kind: "annual_fee",
          issuer: input.source.issuer,
          subject: `${input.source.issuer} listing (unattributed)`,
          rawValue: m[0],
          parsedNumber: Number(m[1]),
          sourceUrl: input.source.url,
          capturedAt: input.capturedAt,
          context: snippetAround(text, m.index),
        }),
      );
    }
  }

  // 4) Earn-rate snippets (raw; category binding left to reviewers)
  EARN_RATE.lastIndex = 0;
  let earnCount = 0;
  while ((m = EARN_RATE.exec(text)) !== null && earnCount < 40) {
    earnCount++;
    push(
      makeFact({
        kind: "earn_rate",
        issuer: input.source.issuer,
        subject: input.source.issuer,
        rawValue: m[0],
        parsedNumber: Number(m[1]),
        sourceUrl: input.source.url,
        capturedAt: input.capturedAt,
        context: snippetAround(text, m.index),
      }),
    );
  }

  return facts;
}

function normalizeLoose(name: string): string {
  return name.toLowerCase().replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
}

function cleanCardSubject(raw: string): string {
  return raw
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\b(Apply|Offer|Conditions|Terms)\b.*$/i, "")
    .trim();
}

function isNoiseSubject(subject: string): boolean {
  const s = subject.toLowerCase();
  return (
    s.length > 90 ||
    /skip to|sign in|personal business|search|cookie|privacy|conditions apply|branch locator|cash advances|bonus scene|rebate for the first|of value in|off travel|uidnq|udi-nq|cbi-roc|including on additional|eligible for ongoing/.test(
      s,
    )
  );
}

function looksLikeCardProduct(subject: string): boolean {
  return /\b(visa|mastercard|american express|amex)\b/i.test(subject);
}
