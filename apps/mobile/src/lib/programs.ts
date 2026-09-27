import type { CreditCard, LoyaltyProgram } from "./api-types";

export interface ProgramDisplay {
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
}

/**
 * Rewards program shown under a card: the loyalty program whose
 * pointCurrency matches the card's (with its logo when the API has one),
 * otherwise the card's own point currency.
 */
export function programForCard(
  card: Pick<CreditCard, "pointCurrency">,
  programs: LoyaltyProgram[],
): ProgramDisplay {
  return programForCurrency(card.pointCurrency, programs);
}

export function programForCurrency(
  currency: string,
  programs: LoyaltyProgram[],
): ProgramDisplay {
  if (currency === "cashback") {
    return { name: "Cash back", logoUrl: null, logoAlt: null };
  }
  const program = programs.find(
    (p) => p.pointCurrency?.toLowerCase() === currency.toLowerCase(),
  );
  if (program) {
    return {
      name: program.name,
      logoUrl: program.logoUrl ?? null,
      logoAlt: program.logoAlt ?? program.name,
    };
  }
  return { name: currency, logoUrl: null, logoAlt: null };
}

/** One or two letters for a logo placeholder: "Scene+" → "S+", "Tim Hortons" → "TH". */
export function initials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  if (!cleaned) return "?";
  if (cleaned === "Cash back") return "$";
  const words = cleaned.split(/[\s-]+/).filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  const word = words[0] ?? cleaned;
  const first = word[0]!.toUpperCase();
  return /\+$/.test(word) ? `${first}+` : first;
}
