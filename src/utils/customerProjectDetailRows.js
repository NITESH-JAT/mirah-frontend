/**
 * Customer-facing project detail rows (meta) and delivery rows (address).
 * Full delivery address is OK on customer side (vendors get country only).
 */

const META_DISPLAY_ORDER = [
  'jewelleryType',
  'jewellery_type',
  'sizeMode',
  'size_mode',
  'sizeStandard',
  'size_standard',
  'sizeCustomValue',
  'size_custom_value',
  'sizeCustomUnit',
  'size_custom_unit',
  'metalType',
  'metal_type',
  'metalPurity',
  'metal_purity',
  'metalColour',
  'metal_colour',
  'twoTonePair',
  'two_tone_pair',
  'twoToneDetails',
  'two_tone_details',
  'otherMetalDetails',
  'other_metal_details',
  'stonesIncluded',
  'stones_included',
  'stoneType',
  'stone_type',
  'stoneQualityBracket',
  'stone_quality_bracket',
  'engravingDetails',
  'engraving_details',
  'changesComparedToReference',
  'changes_compared_to_reference',
  'budgetPerPiece',
  'budget_per_piece',
  'quantityRequired',
  'quantity_required',
  'preferredDeliveryTimeline',
  'preferred_delivery_timeline',
  'additionalNotes',
  'additional_notes',
];

const ALWAYS_SKIP = new Set(['confirmSpecs', 'confirm_specs']);

function toTitleCase(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBlank(v) {
  return v == null || String(v).trim() === '' || String(v).trim() === '—';
}

function deliverySnapshotOf(project) {
  const snap = project?.deliveryAddressSnapshot || project?.delivery_address_snapshot;
  return snap && typeof snap === 'object' ? snap : null;
}

/**
 * Spec / meta rows only (no delivery address).
 * @param {object|null|undefined} project
 * @param {{ formatMoney?: (n: number|string) => string, formatDate?: (raw: string) => string }} [opts]
 */
export function buildCustomerProjectDetailRows(project, opts = {}) {
  const formatMoney = typeof opts.formatMoney === 'function' ? opts.formatMoney : (v) => String(v);
  const formatDate = typeof opts.formatDate === 'function' ? opts.formatDate : (v) => String(v);

  const meta = project?.meta ?? project?.projectMeta ?? null;
  const values = meta?.values ?? meta?.data ?? null;
  const schema = meta?.schema ?? meta?.fields ?? null;
  if (!values || typeof values !== 'object') {
    return [];
  }

  const byKey = new Map();
  for (const [k, v] of Object.entries(values)) {
    if (!k || ALWAYS_SKIP.has(k)) continue;
    const label = schema?.[k]?.label ?? toTitleCase(k);
    let value = v;
    if (Array.isArray(value)) value = value.filter(Boolean).join(', ');
    else if (value && typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch {
        value = String(value);
      }
    }
    const key = String(k).trim();
    if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
    if ((key === 'sizeMode' || key === 'size_mode') && typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'custom') value = 'Custom';
      else if (normalized === 'standard') value = 'Standard';
    }
    if ((key === 'stonesIncluded' || key === 'stones_included') && typeof value === 'string') {
      const n = value.trim().toLowerCase();
      if (n === 'yes') value = 'Yes';
      else if (n === 'no') value = 'No';
    }
    if (key === 'budgetPerPiece' || key === 'budget_per_piece') {
      const n = Number(value);
      value = Number.isFinite(n) ? formatMoney(n) : value;
    }
    if (key === 'preferredDeliveryTimeline' || key === 'preferred_delivery_timeline') {
      const raw = String(value || '').trim();
      value = raw ? formatDate(raw) : value;
    }
    byKey.set(key, {
      key,
      label: String(label || k),
      value: value == null || value === '' ? '—' : String(value),
    });
  }

  const sizeMode = String(byKey.get('sizeMode')?.value ?? byKey.get('size_mode')?.value ?? '')
    .trim()
    .toLowerCase();
  const customVal = String(
    byKey.get('sizeCustomValue')?.value ?? byKey.get('size_custom_value')?.value ?? '',
  ).trim();
  const customUnit = String(
    byKey.get('sizeCustomUnit')?.value ?? byKey.get('size_custom_unit')?.value ?? '',
  ).trim();
  const customDisplay = `${customVal === '—' ? '' : customVal}${customUnit && customUnit !== '—' ? ` ${customUnit}` : ''}`.trim();

  // Fold custom size into one row; drop raw custom unit/value keys from the list.
  byKey.delete('sizeCustomValue');
  byKey.delete('size_custom_value');
  byKey.delete('sizeCustomUnit');
  byKey.delete('size_custom_unit');

  const ordered = [];
  const used = new Set();
  for (const key of META_DISPLAY_ORDER) {
    if (!byKey.has(key) || used.has(key)) continue;
    ordered.push(byKey.get(key));
    used.add(key);
    if ((key === 'sizeMode' || key === 'size_mode') && sizeMode === 'custom') {
      ordered.push({ key: 'customSizeDisplay', label: 'Custom Size', value: customDisplay || '—' });
    }
  }
  for (const [key, row] of byKey.entries()) {
    if (used.has(key)) continue;
    ordered.push(row);
    used.add(key);
  }

  // Hide empty optional blanks (keep structural rows even if — for size/metal basics).
  const keepEvenIfBlank = new Set([
    'jewelleryType',
    'jewellery_type',
    'sizeMode',
    'size_mode',
    'metalType',
    'metal_type',
    'stonesIncluded',
    'stones_included',
    'budgetPerPiece',
    'budget_per_piece',
    'quantityRequired',
    'quantity_required',
    'preferredDeliveryTimeline',
    'preferred_delivery_timeline',
    'customSizeDisplay',
  ]);
  return ordered.filter((r) => keepEvenIfBlank.has(r.key) || !isBlank(r.value));
}

/**
 * Customer delivery address rows (full snapshot when available).
 * @param {object|null|undefined} project
 */
export function buildCustomerDeliveryDetailRows(project) {
  const rows = [];
  const snap = deliverySnapshotOf(project);
  if (!snap) {
    const countryOnly = String(project?.deliveryCountry || project?.delivery_country || '').trim();
    if (countryOnly) {
      rows.push({ key: 'deliveryCountry', label: 'Delivery country', value: countryOnly });
    }
    return rows;
  }

  const name = String(snap.fullName || snap.name || '').trim();
  const phone = String(snap.phone || '').trim();
  const line1 = String(snap.addressLine1 || snap.address || '').trim();
  const line2 = String(snap.addressLine2 || '').trim();
  const city = String(snap.city || '').trim();
  const state = String(snap.state || '').trim();
  const pin = String(snap.postalCode || snap.pinCode || snap.pincode || '').trim();
  const country = String(snap.country || project?.deliveryCountryCode || project?.deliveryCountry || '').trim();

  const cityLine = [city, state, pin].filter(Boolean).join(', ');
  const addressBlock = [line1, line2, cityLine, country].filter(Boolean).join('\n');

  if (name) rows.push({ key: 'deliveryFullName', label: 'Delivery full name', value: name });
  if (phone) rows.push({ key: 'deliveryPhone', label: 'Delivery phone', value: phone });
  if (addressBlock) {
    rows.push({ key: 'deliveryAddress', label: 'Delivery address', value: addressBlock });
  } else if (country) {
    rows.push({ key: 'deliveryCountry', label: 'Delivery country', value: country });
  }

  return rows;
}

/**
 * Vendor-facing delivery rows (country only).
 * @param {object|null|undefined} project
 */
export function buildVendorDeliveryDetailRows(project) {
  const country = String(project?.deliveryCountry || project?.delivery_country || '').trim();
  if (!country) return [];
  return [{ key: 'deliveryCountry', label: 'Delivery country', value: country }];
}
