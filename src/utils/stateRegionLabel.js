import {
  DEFAULT_STATE_REGION_LABEL,
  STATE_REGION_LABEL_BY_COUNTRY_CODE,
} from '../constants/stateRegionLabels';

export function extractCountryCodesList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.countries)) return payload.countries;
  return [];
}

export function normalizeCountryLookupRows(data) {
  return extractCountryCodesList(data).map((c) => ({
    code: c.countryCode ?? c.code,
    name: c.countryName ?? c.name,
  }));
}

export function getStateRegionLabel(countryCode) {
  const code = String(countryCode ?? '').trim().toUpperCase();
  if (!code) return DEFAULT_STATE_REGION_LABEL;
  return STATE_REGION_LABEL_BY_COUNTRY_CODE[code] ?? DEFAULT_STATE_REGION_LABEL;
}

export function resolveCountryIsoCode(countryRef, countries = []) {
  const raw = String(countryRef ?? '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const lower = raw.toLowerCase();
  for (const c of countries) {
    const code = String(c.code ?? c.countryCode ?? '').trim().toUpperCase();
    const name = String(c.name ?? c.countryName ?? '').trim();
    if (!code) continue;
    if (name && name.toLowerCase() === lower) return code;
  }

  return '';
}

export function getStateRegionLabelForCountry(countryRef, countries = []) {
  return getStateRegionLabel(resolveCountryIsoCode(countryRef, countries));
}
