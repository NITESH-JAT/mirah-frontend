/**
 * INR-style amounts: Indian digit grouping (thousands, lakhs, crores).
 * Example: 250000 → "2,50,000"
 */
export function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
