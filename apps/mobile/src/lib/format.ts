export function formatCentsPerDollar(cents: number): string {
  const rounded = Math.round(cents * 10) / 10;
  const display = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${display}¢/$`;
}

export function formatCad(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
