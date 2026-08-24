/**
 * When operational status is `invoice`, show payment-due labels.
 * Supports full-upfront (single payment) and legacy advance/final split.
 */
export function invoiceProjectStatusLabel(advanceStatus, finalStatus, { fullUpfront = false } = {}) {
  const adv = String(advanceStatus ?? '').trim().toLowerCase();
  const fin = String(finalStatus ?? '').trim().toLowerCase();

  if (fullUpfront || fin === 'not_applicable' || fin === 'not_applicble') {
    if (adv === 'due') return 'Invoice (Full Payment)';
    if (adv === 'paid') return 'Full Payment Received';
    return 'Invoice (Full Payment)';
  }

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
