/** Vendor bids are for the entire order (all pieces), not per piece. */

export function parsePositiveNumber(raw) {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parsePositiveInt(raw) {
  const n = parsePositiveNumber(raw);
  if (n == null) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

/** Customer listing budget × quantity — guidance only; bid is still a free amount. */
export function estimateOrderBudget(budgetPerPieceRaw, quantityRaw) {
  const bpp = parsePositiveNumber(budgetPerPieceRaw);
  const qty = parsePositiveInt(quantityRaw);
  if (bpp == null || qty == null) return null;
  return Math.round(bpp * qty * 100) / 100;
}

export function quantityPiecesLabel(quantityRaw) {
  const qty = parsePositiveInt(quantityRaw);
  if (qty == null) return null;
  return qty === 1 ? '1 piece' : `${qty} pieces`;
}

export function bidAmountFieldLabel(quantityRaw, currency) {
  const pieces = quantityPiecesLabel(quantityRaw);
  const cur = currency ? ` (${currency})` : '';
  if (pieces) return `Bid for entire order — ${pieces}${cur}`;
  return `Bid for entire order${cur}`;
}
