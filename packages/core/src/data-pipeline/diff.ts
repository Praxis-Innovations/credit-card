import type { CreditCard, MerchantPartnership } from "../schema";
import { namesLooselyMatch, normalizeName } from "./extract/html";
import { BIG_SIX_ISSUERS } from "./types";
import type {
  BigSixIssuer,
  DiffFinding,
  DiffReport,
  StagingFact,
  StagingSnapshot,
} from "./types";

const FEE_TOLERANCE = 0.01;

export interface DiffInput {
  snapshot: StagingSnapshot;
  cards: CreditCard[];
  partnerships: MerchantPartnership[];
}

/**
 * Compare staging facts against production cards.ts / partnerships.ts.
 * Produces review candidates only — never mutates production datasets.
 */
export function diffStagingAgainstProduction(input: DiffInput): DiffReport {
  const { snapshot, cards, partnerships } = input;
  const findings: DiffFinding[] = [];
  const bigSixCards = cards.filter((c) =>
    (BIG_SIX_ISSUERS as readonly string[]).includes(c.issuer),
  );

  for (const attempt of snapshot.sources) {
    if (attempt.outcome !== "ok") {
      findings.push({
        kind: "source_failure",
        severity: "review",
        issuer: attempt.issuer,
        subject: attempt.sourceId,
        summary: `Source fetch ${attempt.outcome}${attempt.httpStatus ? ` (HTTP ${attempt.httpStatus})` : ""}${attempt.error ? `: ${attempt.error}` : ""}`,
        stagingValue: attempt.outcome,
        sourceUrls: [attempt.url],
        relatedFactIds: [],
      });
    }
  }

  for (const issuer of BIG_SIX_ISSUERS) {
    findings.push(
      ...diffCardsForIssuer(
        issuer,
        bigSixCards.filter((c) => c.issuer === issuer),
        snapshot.facts.filter((f) => f.issuer === issuer),
      ),
    );
  }

  findings.push(...diffPartnerships(snapshot.facts, partnerships));

  const summary = {
    newCardCandidates: count(findings, "new_card_candidate"),
    removedCardCandidates: count(findings, "removed_card_candidate"),
    feeChanges: count(findings, "fee_change_candidate"),
    earnRateChanges: count(findings, "earn_rate_change_candidate"),
    newPartnershipCandidates: count(findings, "new_partnership_candidate"),
    partnershipConflicts: count(findings, "partnership_conflict"),
    sourceFailures: count(findings, "source_failure"),
  };

  return {
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    productionCardCount: bigSixCards.length,
    stagingFactCount: snapshot.facts.length,
    findings,
    summary,
  };
}

function diffCardsForIssuer(
  issuer: BigSixIssuer,
  production: CreditCard[],
  facts: StagingFact[],
): DiffFinding[] {
  const out: DiffFinding[] = [];
  const nameFacts = facts.filter((f) => f.kind === "card_name");
  const feeFacts = facts.filter((f) => f.kind === "annual_fee");
  const currencyFacts = facts.filter((f) => f.kind === "point_currency");
  const earnFacts = facts.filter((f) => f.kind === "earn_rate");

  const matchedProductionIds = new Set<string>();

  for (const card of production) {
    const nameHit = nameFacts.find((f) =>
      namesLooselyMatch(f.subject, card.name),
    );
    if (nameHit) {
      matchedProductionIds.add(card.id);
      out.push({
        kind: "unchanged_signal",
        severity: "info",
        issuer,
        subject: card.name,
        summary: `Catalog card still mentioned on issuer pages`,
        productionValue: card.name,
        stagingValue: nameHit.rawValue,
        sourceUrls: [nameHit.sourceUrl],
        relatedFactIds: [nameHit.id],
      });
    }

    const feeHit = feeFacts.find((f) => namesLooselyMatch(f.subject, card.name));
    if (feeHit && feeHit.parsedNumber !== undefined) {
      matchedProductionIds.add(card.id);
      if (Math.abs(feeHit.parsedNumber - card.annualFee) > FEE_TOLERANCE) {
        out.push({
          kind: "fee_change_candidate",
          severity: "review",
          issuer,
          subject: card.name,
          summary: `Annual fee on page ($${feeHit.parsedNumber}) differs from catalog ($${card.annualFee})`,
          productionValue: String(card.annualFee),
          stagingValue: String(feeHit.parsedNumber),
          sourceUrls: [feeHit.sourceUrl],
          relatedFactIds: [feeHit.id],
        });
      }
    }

    const currencyHit = currencyFacts.find((f) =>
      namesLooselyMatch(f.subject, card.name),
    );
    if (currencyHit) {
      const prodNorm = normalizeName(card.pointCurrency);
      const stageNorm = normalizeName(currencyHit.rawValue);
      if (prodNorm !== stageNorm && !prodNorm.includes(stageNorm) && !stageNorm.includes(prodNorm)) {
        out.push({
          kind: "point_currency_change_candidate",
          severity: "review",
          issuer,
          subject: card.name,
          summary: `Point currency hint "${currencyHit.rawValue}" differs from catalog "${card.pointCurrency}"`,
          productionValue: card.pointCurrency,
          stagingValue: currencyHit.rawValue,
          sourceUrls: [currencyHit.sourceUrl],
          relatedFactIds: [currencyHit.id],
        });
      }
    }

    // Earn-rate: flag only when a parsed rate near the card name contradicts
    // a published category rate (exact equality check on magnitude).
    const cardEarn = earnFacts.filter(
      (f) =>
        namesLooselyMatch(f.subject, card.name) ||
        (f.context &&
          normalizeName(f.context).includes(normalizeName(card.name))),
    );
    for (const earn of cardEarn) {
      if (earn.parsedNumber === undefined) continue;
      const matchesAny = card.rewardCategories.some(
        (rc) => Math.abs(rc.earnRate - earn.parsedNumber!) < FEE_TOLERANCE,
      );
      if (!matchesAny && earn.parsedNumber >= 1) {
        out.push({
          kind: "earn_rate_change_candidate",
          severity: "review",
          issuer,
          subject: card.name,
          summary: `Earn-rate snippet "${earn.rawValue}" does not match any catalog rate for this card`,
          productionValue: card.rewardCategories
            .map((rc) => `${rc.category}:${rc.earnRate}`)
            .join(", "),
          stagingValue: earn.rawValue,
          sourceUrls: [earn.sourceUrl],
          relatedFactIds: [earn.id],
        });
      }
    }
  }

  // New card candidates: name facts that don't match any production card
  const novelNames = new Map<string, StagingFact>();
  for (const fact of nameFacts) {
    if (fact.subject.includes("(unattributed)")) continue;
    const matchesProd = production.some((c) =>
      namesLooselyMatch(c.name, fact.subject),
    );
    if (!matchesProd) {
      const key = normalizeName(fact.subject);
      if (!novelNames.has(key)) novelNames.set(key, fact);
    }
  }
  for (const fact of novelNames.values()) {
    // Ignore very generic / non-product subjects
    const tokens = normalizeName(fact.subject).split(" ").filter(Boolean);
    if (tokens.length < 2) continue;
    if (!/\b(visa|mastercard|american express|amex)\b/i.test(fact.subject)) {
      continue;
    }
    out.push({
      kind: "new_card_candidate",
      severity: "review",
      issuer,
      subject: fact.subject,
      summary: `Page mentions card-like product not matched in cards.ts`,
      stagingValue: fact.rawValue,
      sourceUrls: [fact.sourceUrl],
      relatedFactIds: [fact.id],
    });
  }

  // Removed candidates: only when we successfully fetched a listing page and
  // saw OTHER cards from this issuer, but not this one (weak signal).
  const listingOk = facts.some(
    (f) => f.kind === "card_name" && f.sourceUrl.length > 0,
  );
  if (listingOk && nameFacts.length >= 2) {
    for (const card of production) {
      if (matchedProductionIds.has(card.id)) continue;
      const mentioned = nameFacts.some((f) =>
        namesLooselyMatch(f.subject, card.name),
      );
      if (!mentioned) {
        out.push({
          kind: "removed_card_candidate",
          severity: "info",
          issuer,
          subject: card.name,
          summary:
            "Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)",
          productionValue: card.name,
          sourceUrls: [...new Set(nameFacts.map((f) => f.sourceUrl))],
          relatedFactIds: [],
        });
      }
    }
  }

  return out;
}

function diffPartnerships(
  facts: StagingFact[],
  partnerships: MerchantPartnership[],
): DiffFinding[] {
  const out: DiffFinding[] = [];
  const benefitFacts = facts.filter((f) => f.kind === "benefit_amount");
  const mentionFacts = facts.filter((f) => f.kind === "partnership_mention");

  // Conflicts: staging benefit amounts vs partnerships that share this source
  // URL or clearly share the same merchant/loyalty brand id.
  for (const benefit of benefitFacts) {
    if (benefit.parsedNumber === undefined) continue;
    const brandNeedle = benefit.brand
      ? normalizeName(benefit.brand).replace(/\+/g, "")
      : "";

    const related = partnerships.filter((p) => {
      if (p.sourceUrls.some((u) => u === benefit.sourceUrl)) return true;
      if (!brandNeedle) return false;
      if (normalizeName(p.id).includes(brandNeedle)) return true;
      if (
        p.loyaltyProgramId &&
        normalizeName(p.loyaltyProgramId).includes(brandNeedle)
      ) {
        return true;
      }
      return p.merchantBrandIds.some((id) =>
        normalizeName(id).includes(brandNeedle),
      );
    });

    if (related.length === 0) {
      out.push({
        kind: "new_partnership_candidate",
        severity: "review",
        issuer: benefit.issuer,
        subject: benefit.subject,
        summary: `Benefit amount "${benefit.rawValue}" has no matching production partnership for this brand/source`,
        stagingValue: benefit.rawValue,
        sourceUrls: [benefit.sourceUrl],
        relatedFactIds: [benefit.id],
      });
      continue;
    }

    const amounts = related.flatMap((p) => p.benefits.map((b) => b.amount));
    const matches = amounts.some(
      (a) => Math.abs(a - benefit.parsedNumber!) < FEE_TOLERANCE,
    );
    if (!matches) {
      out.push({
        kind: "partnership_conflict",
        severity: "conflict",
        issuer: benefit.issuer,
        subject: benefit.subject,
        summary: `Staged benefit "${benefit.rawValue}" contradicts cited amounts on related partnerships [${related.map((p) => p.id).join(", ")}]`,
        productionValue: amounts.join(", "),
        stagingValue: String(benefit.parsedNumber),
        sourceUrls: [
          benefit.sourceUrl,
          ...related.flatMap((p) => p.sourceUrls),
        ],
        relatedFactIds: [benefit.id],
      });
    }
  }

  // New partnership mentions: brand pairs not covered by production ids / notes
  const knownBrandNeedles = new Set(
    partnerships.flatMap((p) => [
      p.id,
      ...p.merchantBrandIds,
      p.loyaltyProgramId ?? "",
    ]),
  );

  const seenMentionKeys = new Set<string>();
  for (const mention of mentionFacts) {
    if (mention.rawValue.startsWith("known_source_for:")) continue;
    const brand = mention.brand ?? mention.subject;
    const key = `${mention.issuer}|${normalizeName(brand)}`;
    if (seenMentionKeys.has(key)) continue;
    seenMentionKeys.add(key);

    const covered = [...knownBrandNeedles].some((needle) =>
      normalizeName(needle).includes(normalizeName(brand).slice(0, 12)),
    );
    // Only flag if we also saw a benefit on same URL (stronger new-deal signal)
    const benefitOnSamePage = benefitFacts.some(
      (b) => b.sourceUrl === mention.sourceUrl,
    );
    if (!covered && benefitOnSamePage) {
      out.push({
        kind: "new_partnership_candidate",
        severity: "review",
        issuer: mention.issuer,
        subject: mention.subject,
        summary: `Partnership mention "${brand}" with benefit text is not clearly covered by partnerships.ts`,
        stagingValue: mention.rawValue,
        sourceUrls: [mention.sourceUrl],
        relatedFactIds: [mention.id],
      });
    }
  }

  return out;
}

function count(
  findings: DiffFinding[],
  kind: DiffFinding["kind"],
): number {
  return findings.filter((f) => f.kind === kind).length;
}
