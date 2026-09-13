import { formatCurrency } from './formatMoney';

/**
 * Resolve display currency for a project payload.
 * - Customers: project lock (`presentmentCurrency` / `projectPresentmentCurrency`)
 * - Vendors: prefer region/IP selection; never fall back to the customer's locked currency
 *   when a region currency is available (avoids INR amounts labeled as EUR/USD).
 */
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

/** Vendor screens: region presentment first; API viewer presentment second; never customer lock alone. */
export function vendorPresentmentCurrency(projectOrRoot, regionCurrency = 'INR') {
  const p = projectOrRoot?.project || projectOrRoot || {};
  const region = String(regionCurrency || '').trim().toUpperCase();
  const viewer = String(
    projectOrRoot?.presentmentCurrency || p.presentmentCurrency || '',
  )
    .trim()
    .toUpperCase();
  const lock = String(p.projectPresentmentCurrency || '').trim().toUpperCase();

  if (/^[A-Z]{3}$/.test(region)) return region;
  // Enriched vendor payloads set presentmentCurrency to viewer and keep lock separately.
  if (/^[A-Z]{3}$/.test(viewer) && (!lock || viewer !== lock)) return viewer;
  if (/^[A-Z]{3}$/.test(viewer)) return viewer;
  return 'INR';
}

export function formatProjectMoney(amount, projectOrRoot, fallbackCurrency = 'INR') {
  return formatCurrency(amount, projectPresentmentCurrency(projectOrRoot, fallbackCurrency));
}
