/**
 * When operational status is `invoice`, always show **Invoice (Advance)** or **Invoice (Final)**,
 * never bare "Invoice". Uses normalized payment statuses (e.g. from `normalizePaymentStatus`).
 */
export function invoiceProjectStatusLabel(advanceStatus, finalStatus) {
  const adv = String(advanceStatus ?? '').trim().toLowerCase();
  const fin = String(finalStatus ?? '').trim().toLowerCase();
  const advDone = adv === 'paid' || adv === 'not_applicable' || adv === 'not_applicble';
  const finDone = fin === 'paid' || fin === 'not_applicable' || fin === 'not_applicble';

  if (adv === 'due') return 'Invoice (Advance)';
  if (fin === 'due') return 'Invoice (Final)';
  if (!advDone && adv !== '—') return 'Invoice (Advance)';
  if (advDone && !finDone && fin !== '—') return 'Invoice (Final)';
  if (!advDone) return 'Invoice (Advance)';
  if (!finDone) return 'Invoice (Final)';
  return 'Invoice (Final)';
}
