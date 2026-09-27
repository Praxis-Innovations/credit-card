/** Parse a typed dollar amount ("$1,200.5" → 1200.5). Null unless > 0. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const value = Math.round(Number(cleaned) * 100) / 100;
  return value > 0 && Number.isFinite(value) ? value : null;
}
