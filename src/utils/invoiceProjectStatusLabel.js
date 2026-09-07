/**
 * When operational status is `invoice`, show a simple Invoice label.
 * Supports full-upfront (single payment) and legacy advance/final split.
 */
export function invoiceProjectStatusLabel(advanceStatus, finalStatus, { fullUpfront = false } = {}) {
  const adv = String(advanceStatus ?? '').trim().toLowerCase();
  const fin = String(finalStatus ?? '').trim().toLowerCase();

  if (fullUpfront || fin === 'not_applicable' || fin === 'not_applicble') {
    if (adv === 'paid') return 'Payment Received';
    return 'Invoice';
  }

  const advDone = adv === 'paid' || adv === 'not_applicable' || adv === 'not_applicble';
  const finDone = fin === 'paid' || fin === 'not_applicable' || fin === 'not_applicble';

  if (adv === 'due' || fin === 'due') return 'Invoice';
  if (!advDone && adv !== '—') return 'Invoice';
  if (advDone && !finDone && fin !== '—') return 'Invoice';
  if (!advDone || !finDone) return 'Invoice';
  return 'Invoice';
}
