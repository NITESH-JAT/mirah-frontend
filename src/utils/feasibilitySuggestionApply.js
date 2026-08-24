/**
 * Parse and apply AI feasibility suggestion actions to project create-form specs.
 */

const METAL_PURITY_VALUES = ['9KT', '14KT', '18KT', '22KT'];
const STONE_QUALITY_ORDER = ['Standard', 'Premium', 'Luxury'];

export function normalizeMetalPurityToken(raw) {
  const m = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .match(/^(\d+)(?:KT|K)?$/);
  if (!m) return null;
  const kt = `${m[1]}KT`;
  return METAL_PURITY_VALUES.includes(kt) ? kt : null;
}

function normalizeStoneQualityBracket(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const hit = STONE_QUALITY_ORDER.find((x) => x.toLowerCase() === s.toLowerCase());
  return hit || null;
}

function normalizeStoneType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('lab')) return 'Lab-Grown Diamonds';
  if (s.includes('natural')) return 'Natural Diamonds';
  return null;
}

function clampDeliveryDays(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(90, Math.max(20, Math.round(x)));
}

/**
 * Merge API suggestionActions with heuristic inference for legacy/plain-text responses.
 */
export function resolveFeasibilitySuggestionActions({ suggestions, suggestionActions, review, specs }) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  const fromApi = Array.isArray(suggestionActions) ? suggestionActions : [];
  const byIndex = new Map();

  for (const raw of fromApi) {
    const idx = Number(raw?.suggestionIndex);
    if (!Number.isFinite(idx) || idx < 0) continue;
    const normalized = normalizeSuggestionAction(raw, specs);
    if (normalized) byIndex.set(idx, normalized);
  }

  list.forEach((text, idx) => {
    if (byIndex.has(idx)) return;
    const inferred = inferSuggestionActionFromText(text, idx, review, specs);
    if (inferred) byIndex.set(idx, inferred);
  });

  return list.map((text, idx) => byIndex.get(idx) ?? null);
}

export function normalizeSuggestionAction(raw, specs) {
  if (!raw || typeof raw !== 'object') return null;
  const field = String(raw.field || '').trim();
  const type = String(raw.type || '').trim();
  const value = raw.value;

  if (field === 'metalPurity' || type === 'metal_purity') {
    const purity = normalizeMetalPurityToken(value);
    if (!purity) return null;
    if (purity === String(specs?.metalPurity || '').trim()) return null;
    return { suggestionIndex: Number(raw.suggestionIndex), type: 'metal_purity', field: 'metalPurity', value: purity };
  }

  if (field === 'stoneQualityBracket' || type === 'stone_quality_bracket') {
    const bracket = normalizeStoneQualityBracket(value);
    if (!bracket) return null;
    if (bracket === String(specs?.stoneQualityBracket || '').trim()) return null;
    return {
      suggestionIndex: Number(raw.suggestionIndex),
      type: 'stone_quality_bracket',
      field: 'stoneQualityBracket',
      value: bracket,
    };
  }

  if (field === 'stoneType' || type === 'stone_type') {
    const stoneType = normalizeStoneType(value);
    if (!stoneType) return null;
    if (stoneType === String(specs?.stoneType || '').trim()) return null;
    return { suggestionIndex: Number(raw.suggestionIndex), type: 'stone_type', field: 'stoneType', value: stoneType };
  }

  if (field === 'preferredDeliveryDays' || type === 'delivery_days') {
    const days = clampDeliveryDays(value);
    if (days == null) return null;
    const current = clampDeliveryDays(specs?.preferredDeliveryDays);
    if (current != null && days <= current) return null;
    return {
      suggestionIndex: Number(raw.suggestionIndex),
      type: 'delivery_days',
      field: 'preferredDeliveryDays',
      value: days,
    };
  }

  if (field === 'changesComparedToReference' || type === 'design_change') {
    const text = String(value || '').trim();
    if (!text) return null;
    return {
      suggestionIndex: Number(raw.suggestionIndex),
      type: 'design_change',
      field: 'changesComparedToReference',
      value: text,
      mode: raw.mode === 'replace' ? 'replace' : 'append',
    };
  }

  if (field === 'budgetPerPiece' || type === 'budget_per_piece') {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return {
      suggestionIndex: Number(raw.suggestionIndex),
      type: 'budget_per_piece',
      field: 'budgetPerPiece',
      value: String(n),
    };
  }

  return null;
}

export function inferSuggestionActionFromText(text, suggestionIndex, review, specs) {
  const s = String(text || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  if (/budget is too low|too low for any gold/.test(lower)) return null;

  if (/lab[- ]?grown/.test(lower) && (/switch|changing|change to/.test(lower) || /natural diamonds cannot/.test(lower))) {
    if (String(specs?.stoneType || '').trim() === 'Lab-Grown Diamonds') return null;
    return { suggestionIndex, type: 'stone_type', field: 'stoneType', value: 'Lab-Grown Diamonds' };
  }

  const purityMatch =
    lower.match(/(?:switching|change|lower|moving)\s+(?:from\s+)?(\d+)\s*k?t?\s+(?:gold\s+)?to\s+(\d+)\s*k?t?/i) ||
    lower.match(/(?:from\s+)?(\d+)\s*k?t?\s+(?:gold\s+)?to\s+(\d+)\s*k?t?/i);
  if (purityMatch) {
    const toPurity = normalizeMetalPurityToken(purityMatch[2]);
    if (toPurity && toPurity !== String(specs?.metalPurity || '').trim()) {
      return { suggestionIndex, type: 'metal_purity', field: 'metalPurity', value: toPurity };
    }
  }

  const bracketExplicit =
    s.match(/(?:from\s+)?(Standard|Premium|Luxury)\s+(?:to|→)\s+(Standard|Premium|Luxury)/i) ||
    s.match(/(?:choose|select|switch to|use)\s+(Standard|Premium|Luxury)/i);
  if (bracketExplicit) {
    const target = normalizeStoneQualityBracket(bracketExplicit[bracketExplicit.length - 1]);
    if (target && target !== String(specs?.stoneQualityBracket || '').trim()) {
      return { suggestionIndex, type: 'stone_quality_bracket', field: 'stoneQualityBracket', value: target };
    }
  }

  if (
    /diamond|stone quality|grade|clarity|vvs|vs1|vs2|si1|si2|\bif\b/.test(lower) &&
    /lower|downgrade|reduce|step down|decrease/.test(lower)
  ) {
    const current = normalizeStoneQualityBracket(specs?.stoneQualityBracket);
    if (current) {
      const idx = STONE_QUALITY_ORDER.indexOf(current);
      if (idx > 0) {
        return {
          suggestionIndex,
          type: 'stone_quality_bracket',
          field: 'stoneQualityBracket',
          value: STONE_QUALITY_ORDER[idx - 1],
        };
      }
    }
  }

  const minDays = Number(review?.minimumProductionDays);
  if (
    Number.isFinite(minDays) &&
    minDays > 0 &&
    (/timeline|delivery|production|lead time|more time|extend|longer|minimum.*days|days required/.test(lower) ||
      review?.timelineFeasible === false)
  ) {
    const targetDays = clampDeliveryDays(minDays);
    const currentDays = clampDeliveryDays(specs?.preferredDeliveryDays) ?? 20;
    if (targetDays != null && targetDays > currentDays) {
      return { suggestionIndex, type: 'delivery_days', field: 'preferredDeliveryDays', value: targetDays };
    }
  }

  if (
    /hollow|pave|shank|band|bangle|necklace|links|wire|profile|accent stones|side stones|open-work|filigree|weight/.test(
      lower,
    ) &&
    !purityMatch &&
    !/lab[- ]?grown/.test(lower)
  ) {
    const existing = String(specs?.changesComparedToReference || '').trim();
    if (existing.includes(s)) return null;
    return {
      suggestionIndex,
      type: 'design_change',
      field: 'changesComparedToReference',
      value: s,
      mode: 'append',
    };
  }

  return null;
}

export function applySuggestionActionToSpecs(specs, action, helpers = {}) {
  const base = { ...(specs || {}) };
  if (!action?.field) return base;

  const preferredDeliveryTimelineFromDays =
    typeof helpers.preferredDeliveryTimelineFromDays === 'function'
      ? helpers.preferredDeliveryTimelineFromDays
      : (days) => {
          const d = new Date();
          d.setDate(d.getDate() + Number(days || 0));
          return d.toISOString().slice(0, 10);
        };

  if (action.field === 'metalPurity') {
    return { ...base, metalPurity: action.value };
  }

  if (action.field === 'stoneQualityBracket') {
    return { ...base, stoneQualityBracket: action.value };
  }

  if (action.field === 'stoneType') {
    const next = { ...base, stoneType: action.value };
    if (action.value === 'Lab-Grown Diamonds') next.stoneQualityBracket = '';
    return next;
  }

  if (action.field === 'preferredDeliveryDays') {
    const days = clampDeliveryDays(action.value);
    return {
      ...base,
      preferredDeliveryDays: days,
      preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(days),
    };
  }

  if (action.field === 'changesComparedToReference') {
    const prev = String(base.changesComparedToReference || '').trim();
    const addition = String(action.value || '').trim();
    if (!addition) return base;
    if (action.mode === 'replace' || !prev) {
      return { ...base, changesComparedToReference: addition };
    }
    return { ...base, changesComparedToReference: `${prev}\n\n${addition}` };
  }

  if (action.field === 'budgetPerPiece') {
    return { ...base, budgetPerPiece: String(action.value) };
  }

  return base;
}

export function suggestionActionApplyLabel(action) {
  if (!action) return null;
  switch (action.type) {
    case 'metal_purity':
      return `Set metal purity to ${String(action.value).replace('KT', 'k')}`;
    case 'stone_quality_bracket':
      return `Set stone quality to ${action.value}`;
    case 'stone_type':
      return `Switch to ${action.value}`;
    case 'delivery_days':
      return `Set delivery timeline to ${action.value} days`;
    case 'design_change':
      return 'Apply design change to form';
    case 'budget_per_piece':
      return `Set budget to ₹${action.value}`;
    default:
      return 'Apply to form';
  }
}
