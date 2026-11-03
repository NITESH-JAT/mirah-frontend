/**
 * Stone quality bracket: stored values stay Standard / Premium / Luxury (plus Custom with free text in
 * `stoneQualityCustom`) so existing projects and AI pricing keep working; only the visible labels change.
 */
export const STONE_QUALITY_OPTIONS = [
  { value: 'Standard', label: 'Tier 3 (Standard)', sparks: 1 },
  { value: 'Premium', label: 'Tier 2 (Premium)', sparks: 2 },
  { value: 'Luxury', label: 'Tier 1 (Luxury)', sparks: 3 },
  { value: 'Custom', label: 'Custom', sparks: 0 },
];

export const STONE_QUALITY_CUSTOM = 'Custom';
export const STONE_QUALITY_CUSTOM_MAX = 120;

const LABEL_BY_VALUE = new Map(STONE_QUALITY_OPTIONS.map((o) => [o.value.toLowerCase(), o.label]));

/** Display text for a stored bracket, e.g. "Tier 2 (Premium)" or "Custom: G–H colour, VS clarity". */
export function formatStoneQualityBracket(value, customText) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === STONE_QUALITY_CUSTOM.toLowerCase()) {
    const text = String(customText ?? '').trim();
    return text ? `Custom: ${text}` : 'Custom';
  }
  return LABEL_BY_VALUE.get(raw.toLowerCase()) ?? raw;
}

export const isStoneQualityBracketKey = (key) => key === 'stoneQualityBracket' || key === 'stone_quality_bracket';
export const isStoneQualityCustomKey = (key) => key === 'stoneQualityCustom' || key === 'stone_quality_custom';
