import { formatCurrency } from './formatMoney';

/** Resolve display currency for a project payload (customer lock or API presentment). */
export function projectPresentmentCurrency(projectOrRoot, fallback = 'INR') {
  const p = projectOrRoot?.project || projectOrRoot || {};
  const code = String(
    p.presentmentCurrency ||
      p.projectPresentmentCurrency ||
      projectOrRoot?.presentmentCurrency ||
      fallback ||
      'INR',
  )
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'INR';
}

export function formatProjectMoney(amount, projectOrRoot, fallbackCurrency = 'INR') {
  return formatCurrency(amount, projectPresentmentCurrency(projectOrRoot, fallbackCurrency));
}
