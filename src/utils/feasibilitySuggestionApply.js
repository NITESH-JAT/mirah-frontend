/**
 * Parse and apply AI feasibility suggestion actions to project create-form specs.
 * Actions are schema-validated specs patches (multi-field allowed).
 */

const METAL_PURITY_VALUES = ['9KT', '14KT', '18KT', '22KT'];
const STONE_QUALITY_ORDER = ['Standard', 'Premium', 'Luxury'];
const METAL_COLOURS = ['Yellow', 'White', 'Rose', 'Two-tone'];
const SIZE_MODES = ['standard', 'custom'];
const SIZE_UNITS = ['cm', 'in'];
const MAX_TEXT = 2000;

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

function normalizeMetalColour(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const hit = METAL_COLOURS.find((x) => x.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  const lower = s.toLowerCase();
  if (lower.includes('two') || lower.includes('2-tone') || lower.includes('two tone')) return 'Two-tone';
  return null;
}

function normalizeStonesIncluded(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'yes' || s === 'no') return s;
  if (s === 'true' || s === 'y') return 'yes';
  if (s === 'false' || s === 'n') return 'no';
  return null;
}

function normalizeText(raw, maxLen = MAX_TEXT) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizePositiveNumberString(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(n);
}

/** Validate raw patch keys against create-project specs schema. */
export function normalizeFeasibilitySpecsPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const patch = {};

  if ('metalPurity' in raw) {
    const v = normalizeMetalPurityToken(raw.metalPurity);
    if (v) patch.metalPurity = v;
  }
  if ('stoneQualityBracket' in raw) {
    const v = normalizeStoneQualityBracket(raw.stoneQualityBracket);
    if (v) patch.stoneQualityBracket = v;
  }
  if ('stoneType' in raw) {
    const v = normalizeStoneType(raw.stoneType);
    if (v) patch.stoneType = v;
  }
  if ('preferredDeliveryDays' in raw) {
    const v = clampDeliveryDays(raw.preferredDeliveryDays);
    if (v != null) patch.preferredDeliveryDays = v;
  }
  if ('budgetPerPiece' in raw) {
    const v = normalizePositiveNumberString(raw.budgetPerPiece);
    if (v) patch.budgetPerPiece = v;
  }
  if ('quantityRequired' in raw) {
    const v = normalizePositiveNumberString(raw.quantityRequired);
    if (v) patch.quantityRequired = v;
  }
  if ('stonesIncluded' in raw) {
    const v = normalizeStonesIncluded(raw.stonesIncluded);
    if (v) patch.stonesIncluded = v;
  }
  if ('metalColour' in raw) {
    const v = normalizeMetalColour(raw.metalColour);
    if (v) patch.metalColour = v;
  }
  if ('metalType' in raw) {
    const v = normalizeText(raw.metalType, 80);
    if (v) patch.metalType = v;
  }
  if ('metalFinish' in raw) {
    const v = normalizeText(raw.metalFinish, 120);
    if (v) patch.metalFinish = v;
  }
  if ('twoTonePair' in raw) {
    const v = normalizeText(raw.twoTonePair, 120);
    if (v) patch.twoTonePair = v;
  }
  if ('twoToneDetails' in raw) {
    const v = normalizeText(raw.twoToneDetails, 500);
    if (v) patch.twoToneDetails = v;
  }
  if ('otherMetalDetails' in raw) {
    const v = normalizeText(raw.otherMetalDetails, 500);
    if (v) patch.otherMetalDetails = v;
  }
  if ('engravingDetails' in raw) {
    const v = normalizeText(raw.engravingDetails);
    if (v) patch.engravingDetails = v;
  }
  if ('additionalNotes' in raw) {
    const v = normalizeText(raw.additionalNotes);
    if (v) patch.additionalNotes = v;
  }
  if ('changesComparedToReference' in raw) {
    const v = normalizeText(raw.changesComparedToReference);
    if (v) patch.changesComparedToReference = v;
  }
  if ('sizeMode' in raw) {
    const v = String(raw.sizeMode || '')
      .trim()
      .toLowerCase();
    if (SIZE_MODES.includes(v)) patch.sizeMode = v;
  }
  if ('sizeStandard' in raw) {
    const v = normalizeText(raw.sizeStandard, 80);
    if (v) patch.sizeStandard = v;
  }
  if ('sizeCustomValue' in raw) {
    const v = normalizeText(raw.sizeCustomValue, 40);
    if (v) patch.sizeCustomValue = v;
  }
  if ('sizeCustomUnit' in raw) {
    const v = String(raw.sizeCustomUnit || '')
      .trim()
      .toLowerCase();
    if (SIZE_UNITS.includes(v)) patch.sizeCustomUnit = v;
  }

  return patch;
}

function patchHasMeaningfulChange(patch, specs) {
  const keys = Object.keys(patch || {});
  if (!keys.length) return false;
  return keys.some((key) => {
    const next = patch[key];
    const cur = specs?.[key];
    if (key === 'preferredDeliveryDays') {
      return clampDeliveryDays(next) !== clampDeliveryDays(cur);
    }
    if (key === 'changesComparedToReference') {
      const addition = String(next || '').trim();
      const existing = String(cur || '').trim();
      return Boolean(addition) && !existing.includes(addition);
    }
    return String(next ?? '').trim() !== String(cur ?? '').trim();
  });
}

function actionFromPatch(suggestionIndex, patch, mode = 'append') {
  if (!patch || !Object.keys(patch).length) return null;
  const keys = Object.keys(patch);
  const field = keys[0];
  return {
    suggestionIndex,
    type: 'specs_patch',
    patch,
    field,
    value: patch[field],
    ...(patch.changesComparedToReference ? { mode } : {}),
  };
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

  return list.map((_text, idx) => byIndex.get(idx) ?? null);
}

function legacySingleFieldToPatch(raw) {
  const field = String(raw.field || '').trim();
  const type = String(raw.type || '').trim();
  const value = raw.value;
  const patch = {};

  if (field === 'metalPurity' || type === 'metal_purity') {
    const purity = normalizeMetalPurityToken(value);
    if (purity) patch.metalPurity = purity;
  } else if (field === 'stoneQualityBracket' || type === 'stone_quality_bracket') {
    const bracket = normalizeStoneQualityBracket(value);
    if (bracket) patch.stoneQualityBracket = bracket;
  } else if (field === 'stoneType' || type === 'stone_type') {
    const stoneType = normalizeStoneType(value);
    if (stoneType) patch.stoneType = stoneType;
  } else if (field === 'preferredDeliveryDays' || type === 'delivery_days') {
    const days = clampDeliveryDays(value);
    if (days != null) patch.preferredDeliveryDays = days;
  } else if (field === 'budgetPerPiece' || type === 'budget_per_piece') {
    const n = normalizePositiveNumberString(value);
    if (n) patch.budgetPerPiece = n;
  } else if (field === 'changesComparedToReference' || type === 'design_change') {
    const text = normalizeText(value);
    if (text) patch.changesComparedToReference = text;
  }

  return patch;
}

export function normalizeSuggestionAction(raw, specs) {
  if (!raw || typeof raw !== 'object') return null;

  const rawPatch = raw.specsPatch ?? raw.specs_patch ?? raw.patch ?? null;
  let patch = {};
  if (rawPatch && typeof rawPatch === 'object' && !Array.isArray(rawPatch)) {
    patch = normalizeFeasibilitySpecsPatch(rawPatch);
  } else if (raw.type === 'specs_patch' && raw.patch && typeof raw.patch === 'object') {
    patch = normalizeFeasibilitySpecsPatch(raw.patch);
  } else {
    patch = legacySingleFieldToPatch(raw);
  }

  if (!Object.keys(patch).length) return null;
  if (!patchHasMeaningfulChange(patch, specs)) return null;

  const mode = raw.mode === 'replace' ? 'replace' : 'append';
  return actionFromPatch(Number(raw.suggestionIndex), patch, mode);
}

export function inferSuggestionActionFromText(text, suggestionIndex, review, specs) {
  const s = String(text || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  if (/budget is too low|too low for any gold/.test(lower)) return null;

  if (/lab[- ]?grown/.test(lower) && (/switch|changing|change to/.test(lower) || /natural diamonds cannot/.test(lower))) {
    if (String(specs?.stoneType || '').trim() === 'Lab-Grown Diamonds') return null;
    return actionFromPatch(suggestionIndex, { stoneType: 'Lab-Grown Diamonds' });
  }

  const purityMatch =
    lower.match(/(?:switching|change|lower|moving)\s+(?:from\s+)?(\d+)\s*k?t?\s+(?:gold\s+)?to\s+(\d+)\s*k?t?/i) ||
    lower.match(/(?:from\s+)?(\d+)\s*k?t?\s+(?:gold\s+)?to\s+(\d+)\s*k?t?/i);
  if (purityMatch) {
    const toPurity = normalizeMetalPurityToken(purityMatch[2]);
    if (toPurity && toPurity !== String(specs?.metalPurity || '').trim()) {
      return actionFromPatch(suggestionIndex, { metalPurity: toPurity });
    }
  }

  const bracketExplicit =
    s.match(/(?:from\s+)?(Standard|Premium|Luxury)\s+(?:to|→)\s+(Standard|Premium|Luxury)/i) ||
    s.match(/(?:choose|select|switch to|use)\s+(Standard|Premium|Luxury)/i);
  if (bracketExplicit) {
    const target = normalizeStoneQualityBracket(bracketExplicit[bracketExplicit.length - 1]);
    if (target && target !== String(specs?.stoneQualityBracket || '').trim()) {
      return actionFromPatch(suggestionIndex, { stoneQualityBracket: target });
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
        return actionFromPatch(suggestionIndex, { stoneQualityBracket: STONE_QUALITY_ORDER[idx - 1] });
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
      return actionFromPatch(suggestionIndex, { preferredDeliveryDays: targetDays });
    }
  }

  const estimated =
    Number(review?.breakdown?.estimatedCostPerPiece) ||
    Number(review?.estimatedCostPerPiece);
  if (
    Number.isFinite(estimated) &&
    estimated > 0 &&
    /budget\s+is\s+too\s+low|revise\s+your\s+budget|increase\s+your\s+budget|raise\s+(?:your\s+)?budget|far\s+below\s+the\s+minimum/.test(
      lower,
    )
  ) {
    const target = String(Math.ceil(estimated * 100) / 100);
    const current = normalizePositiveNumberString(specs?.budgetPerPiece);
    if (!current || Number(current) + 0.5 < Number(target)) {
      return actionFromPatch(suggestionIndex, { budgetPerPiece: target });
    }
  }

  // Design/weight free-text no longer invents an Apply action.
  // Apply only when the API returns a validated specsPatch (e.g. short changesComparedToReference).
  return null;
}

export function applySuggestionActionToSpecs(specs, action, helpers = {}) {
  const base = { ...(specs || {}) };
  const patch =
    action?.patch && typeof action.patch === 'object'
      ? normalizeFeasibilitySpecsPatch(action.patch)
      : action?.field
        ? legacySingleFieldToPatch(action)
        : {};

  if (!Object.keys(patch).length) return base;

  const preferredDeliveryTimelineFromDays =
    typeof helpers.preferredDeliveryTimelineFromDays === 'function'
      ? helpers.preferredDeliveryTimelineFromDays
      : (days) => {
          const d = new Date();
          d.setDate(d.getDate() + Number(days || 0));
          return d.toISOString().slice(0, 10);
        };

  const next = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'preferredDeliveryDays') {
      const days = clampDeliveryDays(value);
      if (days == null) continue;
      next.preferredDeliveryDays = days;
      next.preferredDeliveryTimeline = preferredDeliveryTimelineFromDays(days);
      continue;
    }

    if (key === 'stoneType') {
      next.stoneType = value;
      if (value === 'Lab-Grown Diamonds') next.stoneQualityBracket = '';
      continue;
    }

    if (key === 'changesComparedToReference') {
      const prev = String(next.changesComparedToReference || '').trim();
      const addition = String(value || '').trim();
      if (!addition) continue;
      if (action?.mode === 'replace' || !prev) {
        next.changesComparedToReference = addition;
      } else if (!prev.includes(addition)) {
        next.changesComparedToReference = `${prev}\n\n${addition}`;
      }
      continue;
    }

    if (key === 'stonesIncluded') {
      next.stonesIncluded = value;
      if (value === 'no') {
        next.stoneType = '';
        next.stoneQualityBracket = '';
      }
      continue;
    }

    if (key === 'metalColour') {
      next.metalColour = value;
      if (value !== 'Two-tone') {
        next.twoToneDetails = '';
        next.twoTonePair = '';
      }
      continue;
    }

    next[key] = value;
  }

  return next;
}

function labelForPatchKey(key, value, options = {}) {
  const currency = String(options.currency || '').trim().toUpperCase() || null;
  switch (key) {
    case 'metalPurity':
      return `Set metal purity to ${String(value).replace('KT', 'k')}`;
    case 'stoneQualityBracket':
      return `Set stone quality to ${value}`;
    case 'stoneType':
      return `Switch to ${value}`;
    case 'preferredDeliveryDays':
      return `Set delivery timeline to ${value} days`;
    case 'budgetPerPiece': {
      const n = Number(value);
      if (currency && Number.isFinite(n)) {
        try {
          return `Set budget to ${new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            currencyDisplay: 'code',
            maximumFractionDigits: 2,
          }).format(n)}`;
        } catch {
          return `Set budget to ${currency} ${value}`;
        }
      }
      return currency ? `Set budget to ${currency} ${value}` : `Set budget to ${value}`;
    }
    case 'quantityRequired':
      return `Set quantity to ${value}`;
    case 'stonesIncluded':
      return value === 'yes' ? 'Include stones' : 'Remove stones';
    case 'metalColour':
      return `Set metal colour to ${value}`;
    case 'metalType':
      return `Set metal type to ${value}`;
    case 'metalFinish':
      return `Set metal finish to ${value}`;
    case 'changesComparedToReference':
      return 'Update changes compared to reference';
    case 'engravingDetails':
      return 'Update engraving details';
    case 'additionalNotes':
      return 'Update additional notes';
    case 'twoTonePair':
      return `Set two-tone pair to ${value}`;
    case 'twoToneDetails':
      return 'Update two-tone details';
    case 'otherMetalDetails':
      return 'Update other metal details';
    case 'sizeMode':
      return `Set size mode to ${value}`;
    case 'sizeStandard':
      return `Set size to ${value}`;
    case 'sizeCustomValue':
      return `Set custom size to ${value}`;
    case 'sizeCustomUnit':
      return `Set size unit to ${value}`;
    default:
      return `Update ${key}`;
  }
}

function getActionPatch(action) {
  if (!action) return null;
  if (action.patch && typeof action.patch === 'object') return action.patch;
  if (action.field) return { [action.field]: action.value };
  return null;
}

/** Human-readable lines for each specs field this action will update. */
export function suggestionActionFieldChangeLabels(action, options = {}) {
  const patch = getActionPatch(action);
  if (!patch || !Object.keys(patch).length) return [];
  return Object.entries(patch).map(([key, value]) => labelForPatchKey(key, value, options));
}

export function suggestionActionApplyLabel(action, options = {}) {
  const lines = suggestionActionFieldChangeLabels(action, options);
  if (!lines.length) return null;
  if (lines.length === 1) return lines[0];
  return lines.join(' · ');
}

function normalizeSuggestionText(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function suggestionPatchAlreadySatisfied(action, specs) {
  const patch = normalizeFeasibilitySpecsPatch(getActionPatch(action) || {});
  const keys = Object.keys(patch);
  if (!keys.length) return false;
  return keys.every((key) => {
    const next = patch[key];
    const cur = specs?.[key];
    if (key === 'preferredDeliveryDays') {
      return clampDeliveryDays(next) === clampDeliveryDays(cur);
    }
    if (key === 'changesComparedToReference') {
      const addition = String(next || '').trim();
      const existing = String(cur || '').trim();
      return Boolean(addition) && existing.includes(addition);
    }
    return String(next ?? '').trim() === String(cur ?? '').trim();
  });
}

export function isFeasibilitySuggestionApplied({ text, action, appliedHistory, specs }) {
  const norm = normalizeSuggestionText(text);
  const history = Array.isArray(appliedHistory) ? appliedHistory : [];
  if (norm && history.some((a) => normalizeSuggestionText(a?.text) === norm)) {
    return true;
  }
  if (action && suggestionPatchAlreadySatisfied(action, specs)) {
    return true;
  }
  return false;
}

/**
 * Rows for the Suggestions panel: applied history first, then remaining live suggestions.
 */
export function buildFeasibilitySuggestionDisplayRows({
  suggestions,
  actions,
  appliedHistory,
  specs,
}) {
  const history = Array.isArray(appliedHistory) ? appliedHistory : [];
  const list = Array.isArray(suggestions) ? suggestions : [];
  const actionList = Array.isArray(actions) ? actions : [];
  const rows = [];
  const seen = new Set();

  for (let i = 0; i < history.length; i += 1) {
    const entry = history[i];
    const text = String(entry?.text || '').trim();
    if (!text) continue;
    const norm = normalizeSuggestionText(text);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const patch = normalizeFeasibilitySpecsPatch(entry?.specsPatch || entry?.patch || {});
    rows.push({
      key: `applied-${i}-${norm.slice(0, 40)}`,
      text,
      applied: true,
      suggestionIndex: null,
      action: Object.keys(patch).length
        ? { type: 'specs_patch', patch, suggestionIndex: null }
        : null,
    });
  }

  list.forEach((sug, idx) => {
    const text = String(sug || '').trim();
    if (!text) return;
    const norm = normalizeSuggestionText(text);
    const action = actionList[idx] ?? null;
    const applied = isFeasibilitySuggestionApplied({
      text,
      action,
      appliedHistory: history,
      specs,
    });
    if (seen.has(norm)) return;
    seen.add(norm);
    rows.push({
      key: `live-${idx}`,
      text,
      applied,
      suggestionIndex: applied ? null : idx,
      action,
    });
  });

  return rows;
}

function patchesOverlapOrRepeat(candidate, applied) {
  const keys = Object.keys(candidate || {});
  if (!keys.length) return false;
  // Same field already applied this session → prevent re-suggest / reverse loops
  return keys.some((key) => key in (applied || {}));
}

/**
 * Client-side safety net: drop looping suggestions/actions already applied this session.
 */
export function filterFeasibilityAgainstHistory(suggestions, actions, history) {
  const appliedList = Array.isArray(history?.appliedSuggestions) ? history.appliedSuggestions : [];
  const previousList = Array.isArray(history?.previousSuggestions) ? history.previousSuggestions : [];
  const round = Number(history?.round) || 0;

  const appliedTexts = new Set(appliedList.map((a) => normalizeSuggestionText(a?.text)).filter(Boolean));
  const previousTexts = new Set(previousList.map((t) => normalizeSuggestionText(t)).filter(Boolean));
  const appliedPatches = appliedList.map((a) => normalizeFeasibilitySpecsPatch(a?.specsPatch || a?.patch || {}));

  const keptActions = [];
  const dropIndexes = new Set();

  for (const action of Array.isArray(actions) ? actions : []) {
    const idx = Number(action?.suggestionIndex);
    const patch = normalizeFeasibilitySpecsPatch(
      action?.patch ?? action?.specsPatch ?? action?.specs_patch ?? {},
    );
    if (appliedPatches.some((ap) => patchesOverlapOrRepeat(patch, ap))) {
      if (Number.isFinite(idx)) dropIndexes.add(idx);
      continue;
    }
    keptActions.push({ ...action, patch });
  }

  const keptSuggestions = [];
  const indexRemap = new Map();

  (Array.isArray(suggestions) ? suggestions : []).forEach((text, oldIdx) => {
    const t = String(text || '').trim();
    if (!t) return;
    const norm = normalizeSuggestionText(t);
    if (dropIndexes.has(oldIdx)) return;
    if (appliedTexts.has(norm)) return;
    const hasKeptAction = keptActions.some((a) => Number(a.suggestionIndex) === oldIdx);
    if (round > 0 && previousTexts.has(norm) && !hasKeptAction) return;
    indexRemap.set(oldIdx, keptSuggestions.length);
    keptSuggestions.push(t);
  });

  const remappedActions = keptActions
    .map((a) => {
      const oldIdx = Number(a.suggestionIndex);
      if (!Number.isFinite(oldIdx) || !indexRemap.has(oldIdx)) return null;
      return { ...a, suggestionIndex: indexRemap.get(oldIdx) };
    })
    .filter(Boolean);

  return { suggestions: keptSuggestions, suggestionActions: remappedActions };
}
