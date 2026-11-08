/**
 * Stone quality bracket: stored values stay Standard / Premium / Luxury (plus Custom with free text in
 * `stoneQualityCustom`) so existing projects and AI pricing keep working. Nobody sees those words:
 * customers see "Tier 1–3", manufacturers see the colour × clarity combination from the
 * Diamond Classification table (components/diamond/DiamondClassificationPanel.jsx).
 */
export const STONE_QUALITY_OPTIONS = [
  { value: 'Standard', label: 'Tier 3', sparks: 1 },
  { value: 'Premium', label: 'Tier 2', sparks: 2 },
  { value: 'Luxury', label: 'Tier 1', sparks: 3 },
  { value: 'Custom', label: 'Custom', sparks: 0 },
];

export const STONE_QUALITY_CUSTOM = 'Custom';
export const STONE_QUALITY_CUSTOM_MAX = 120;

/** Colour × clarity per tier, read off the classification table (G/H rows match; I is one step stricter). */
export const STONE_QUALITY_GRADES = {
  Luxury: 'G–H colour, VVS–VS1 clarity, or I colour, VVS clarity',
  Premium: 'G–H colour, VS2–SI1 clarity, or I colour, VS1–VS2 clarity',
  Standard: 'G–H colour, SI2–I1 clarity, or I colour, SI1–I1 clarity',
};

/** Inclusion rule from the same table: a visible black inclusion drops a stone one tier. */
export const STONE_QUALITY_INCLUSION_NOTE = 'no visible black inclusions';

const LABEL_BY_VALUE = new Map(STONE_QUALITY_OPTIONS.map((o) => [o.value.toLowerCase(), o.label]));
const GRADES_BY_VALUE = new Map(Object.entries(STONE_QUALITY_GRADES).map(([k, v]) => [k.toLowerCase(), v]));

const isCustom = (raw) => raw.toLowerCase() === STONE_QUALITY_CUSTOM.toLowerCase();
const customLabel = (customText) => {
  const text = String(customText ?? '').trim();
  return text ? `Custom: ${text}` : 'Custom';
};

/** Customer-facing text for a stored bracket, e.g. "Tier 2" or "Custom: G–H colour, VS1 clarity". */
export function formatStoneQualityBracket(value, customText) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (isCustom(raw)) return customLabel(customText);
  return LABEL_BY_VALUE.get(raw.toLowerCase()) ?? raw;
}

/** Manufacturer-facing text: the colour × clarity to source, never the tier name. */
export function formatStoneQualityForManufacturer(value, customText) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (isCustom(raw)) return customLabel(customText);
  const grades = GRADES_BY_VALUE.get(raw.toLowerCase());
  return grades ? `${grades}; ${STONE_QUALITY_INCLUSION_NOTE}` : raw;
}

export const isStoneQualityBracketKey = (key) => key === 'stoneQualityBracket' || key === 'stone_quality_bracket';
export const isStoneQualityCustomKey = (key) => key === 'stoneQualityCustom' || key === 'stone_quality_custom';
