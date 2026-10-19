export const PIN_CODE_MAX_LENGTH = 20;

/** Returns an empty string when the value is blank or a valid postal code. */
export function pinCodeError(value) {
  const pin = String(value || '').trim();
  if (!pin) return '';
  if (pin.includes('@')) return 'Enter your pin code, not your email';
  if (pin.length > PIN_CODE_MAX_LENGTH || !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(pin)) {
    return 'Use letters, numbers, spaces, or hyphens (max 20)';
  }
  return '';
}
