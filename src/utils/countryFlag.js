/** Convert ISO-3166 alpha-2 (e.g. AE) to a flag emoji (🇦🇪). */
export function isoCountryCodeToFlagEmoji(iso) {
  const code = String(iso || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

/** Compact dial-code trigger label: 🇦🇪 +971 */
export function formatDialCodeTriggerLabel({ iso, phoneCode, fallback }) {
  const dial = String(phoneCode || '').trim();
  const flag = isoCountryCodeToFlagEmoji(iso);
  if (flag && dial) return `${flag} ${dial}`;
  if (dial) return dial;
  return String(fallback || '').trim() || '';
}

/** Dial-code text only (flag is rendered separately in the UI). */
export function formatDialCodeOptionLabel({ phoneCode }) {
  return String(phoneCode || '').trim();
}
