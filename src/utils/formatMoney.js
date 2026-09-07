/**
 * INR-style amounts: Indian digit grouping (thousands, lakhs, crores).
 * Example: 250000 → "2,50,000"
 */
export function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatCurrency(v, currency = 'INR', locale) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const code = /^[A-Z]{3}$/.test(String(currency || '').toUpperCase())
    ? String(currency).toUpperCase()
    : 'INR';
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'symbol',
  }).formatToParts(n);

  // Ensure a space between currency symbol/code and the amount (e.g. "US$ 333.66").
  let out = '';
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    out += part.value;
    if (!next) continue;
    if (part.type === 'currency' && next.type !== 'literal') {
      out += ' ';
    } else if (next.type === 'currency' && part.type !== 'literal' && part.type !== 'currency') {
      out += ' ';
    }
  }
  return out;
}
