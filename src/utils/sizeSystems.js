/**
 * Size systems for Create Project (rings: US, UK, India), configured per jewellery type in the admin panel.
 * Each system is a list of { label, mm } where mm is the inner circumference. Equivalents across systems are
 * found by nearest circumference. Mirrors mira-backend/src/utils/sizeSystems.ts.
 *
 * The chosen size is saved in the existing `sizeStandard` field as a self-describing label, e.g.
 * "India 14 · 54.4 mm (≈ US 7 · UK N)", so manufacturer pages and the brief PDF show every equivalent.
 */

const SEPARATOR = '·';

/** Accepted inner circumference for a custom ring size, in mm (roughly a child's ring to a very large one). */
export const CUSTOM_RING_MM_MIN = 35;
export const CUSTOM_RING_MM_MAX = 80;

export const roundMm = (n) => Math.round(Number(n) * 10) / 10;

export function normalizeSizeSystems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((sys) => {
      const code = String(sys?.code ?? '').trim().toUpperCase();
      if (!code) return null;
      const label = String(sys?.label ?? '').trim() || code;
      const sizes = (Array.isArray(sys?.sizes) ? sys.sizes : [])
        .map((s) => ({ label: String(s?.label ?? '').trim(), mm: Number(s?.mm) }))
        .filter((s) => s.label && Number.isFinite(s.mm) && s.mm > 0)
        .sort((a, b) => a.mm - b.mm);
      return sizes.length ? { code, label, sizes } : null;
    })
    .filter(Boolean);
}

/** Closest size by circumference; an exact tie goes to the larger size (a loose ring is easier to fix). */
export function nearestSize(system, mm) {
  let best = null;
  for (const s of system?.sizes || []) {
    if (!best) {
      best = s;
      continue;
    }
    const d = Math.abs(s.mm - mm);
    const bestD = Math.abs(best.mm - mm);
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) <= 1e-6 && s.mm > best.mm)) best = s;
  }
  return best;
}

/** "US 7 · UK N" for the systems other than `exceptCode`. */
export function equivalentsText(systems, mm, exceptCode) {
  return systems
    .filter((s) => s.code !== exceptCode)
    .map((s) => {
      const near = nearestSize(s, mm);
      return near ? `${s.label} ${near.label}` : '';
    })
    .filter(Boolean)
    .join(` ${SEPARATOR} `);
}

/** The label saved as `sizeStandard`. */
export function formatSizeSelectionLabel(systems, code, sizeLabel) {
  const system = systems.find((s) => s.code === code);
  const entry = system?.sizes.find((s) => s.label === sizeLabel);
  if (!system || !entry) return '';
  const others = equivalentsText(systems, entry.mm, code);
  const head = `${system.label} ${entry.label} ${SEPARATOR} ${entry.mm} mm`;
  return others ? `${head} (≈ ${others})` : head;
}

/**
 * Reads a saved `sizeStandard` back into { code, label }. Understands the current format and the older
 * single-list labels such as "N (54.4 mm)" or "N".
 */
export function parseSizeSelection(systems, sizeStandard) {
  const raw = String(sizeStandard || '').trim();
  if (!raw || !systems.length) return null;
  const head = raw.split(SEPARATOR)[0].trim();
  for (const sys of systems) {
    if (head.startsWith(`${sys.label} `)) {
      const label = head.slice(sys.label.length + 1).trim();
      if (sys.sizes.some((s) => s.label === label)) return { code: sys.code, label };
    }
  }
  const legacy = /^(.*?)\s*(?:\(([\d.]+)\s*mm\))?$/i.exec(raw);
  const legacyLabel = String(legacy?.[1] || '').trim();
  const legacyMm = legacy?.[2] ? Number(legacy[2]) : null;
  const hits = [];
  for (const sys of systems) {
    const hit = sys.sizes.find((s) => s.label.toLowerCase() === legacyLabel.toLowerCase());
    if (hit) hits.push({ sys, hit });
  }
  const exact = hits.find(({ hit }) => legacyMm == null || Math.abs(hit.mm - legacyMm) < 0.05) || hits[0];
  return exact ? { code: exact.sys.code, label: exact.hit.label } : null;
}

/** The toggle to start on: the visitor's region when a system matches it, else the first one. */
export function defaultSizeSystemCode(systems, countryCode) {
  if (!systems.length) return '';
  const cc = String(countryCode || '').trim().toUpperCase();
  const wanted = cc === 'IN' ? 'IN' : cc === 'GB' || cc === 'UK' ? 'UK' : cc === 'US' ? 'US' : '';
  return systems.some((s) => s.code === wanted) ? wanted : systems[0].code;
}

/** Step validation for a jewellery type that has size systems. Returns an error message or null. */
export function validateSizeSystemSpecs(systems, specs) {
  const mode = String(specs?.sizeMode || 'standard').trim().toLowerCase();
  if (mode === 'custom') {
    const v = Number(specs?.sizeCustomValue);
    if (!Number.isFinite(v) || v <= 0) return 'Enter your ring size in mm';
    if (v < CUSTOM_RING_MM_MIN || v > CUSTOM_RING_MM_MAX) {
      return `Ring size should be an inner circumference between ${CUSTOM_RING_MM_MIN} and ${CUSTOM_RING_MM_MAX} mm`;
    }
    return null;
  }
  if (!parseSizeSelection(systems, specs?.sizeStandard)) return 'Size is required';
  return null;
}
