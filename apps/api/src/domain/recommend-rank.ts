/** Shared tie-break for card ranking by earn value. */
export function compareByCentsThenFeeThenName(
  a: {
    centsPerDollar: number;
    card: { annualFee: number; name: string };
  },
  b: {
    centsPerDollar: number;
    card: { annualFee: number; name: string };
  },
): number {
  if (b.centsPerDollar !== a.centsPerDollar) {
    return b.centsPerDollar - a.centsPerDollar;
  }
  if (a.card.annualFee !== b.card.annualFee) {
    return a.card.annualFee - b.card.annualFee;
  }
  return a.card.name.localeCompare(b.card.name);
}
