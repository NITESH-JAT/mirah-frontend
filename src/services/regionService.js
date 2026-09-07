import { apiClient } from './apiClient';

/** Browser calls country.is (uses the visitor's public IP). */
export const CLIENT_IP_GEO_URL = 'https://api.country.is';

function normalizeRegionPayload(data) {
  if (!data) return null;
  const countryCode = data?.country?.code || data?.countryCode || null;
  const countryName = data?.country?.name || data?.countryName || null;
  const flag = data?.country?.flag || '';
  const currency = data?.currency?.code || data?.currency || null;
  const options = Array.isArray(data?.options) ? data.options : [];
  const examples =
    data?.examples && typeof data.examples === 'object'
      ? {
          budgetPerPiece: data.examples.budgetPerPiece != null ? String(data.examples.budgetPerPiece) : null,
        }
      : null;
  return {
    countryCode,
    countryName,
    flag,
    currency,
    source: data?.source || null,
    options,
    examples,
  };
}

/** Detect ISO country from the browser's public IP via country.is. */
export async function detectCountryFromClientIp({ timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(CLIENT_IP_GEO_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const code = String(body?.countryCode || body?.country_code || body?.country || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const regionService = {
  async getRegion() {
    const res = await apiClient.get('/api/public/region');
    return normalizeRegionPayload(res?.data?.data);
  },

  async setRegion(countryCode) {
    const res = await apiClient.post('/api/public/region', { countryCode });
    return normalizeRegionPayload(res?.data?.data);
  },
};
