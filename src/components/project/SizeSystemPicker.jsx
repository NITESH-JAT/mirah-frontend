import React, { useMemo, useState } from 'react';
import {
  CUSTOM_RING_MM_MAX,
  CUSTOM_RING_MM_MIN,
  defaultSizeSystemCode,
  formatSizeSelectionLabel,
  nearestSize,
  parseSizeSelection,
} from '../../utils/sizeSystems';

const CUSTOM = 'CUSTOM';

const fieldClass =
  'w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut';

function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex w-full rounded-xl border border-pale bg-white p-1 gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
              active ? 'bg-walnut text-blush' : 'text-mid hover:bg-cream'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Size field for a jewellery type with size systems (rings): toggles for each system (US / UK / India) plus
 * Custom, where the customer enters their own inner circumference in mm. Switching systems keeps the same ring size by picking the
 * nearest equivalent. Writes the existing spec fields (sizeMode, sizeStandard, sizeCustomValue, sizeCustomUnit).
 */
export default function SizeSystemPicker({ systems, specs, onChange, countryCode }) {
  const parsed = useMemo(() => parseSizeSelection(systems, specs?.sizeStandard), [systems, specs?.sizeStandard]);
  const isCustom = String(specs?.sizeMode || '').toLowerCase() === 'custom';

  // The toggle the customer is looking at while nothing is chosen yet; otherwise the specs decide.
  const [browsing, setBrowsing] = useState(null);

  const active = isCustom
    ? CUSTOM
    : parsed?.code ||
      (systems.some((s) => s.code === browsing) ? browsing : defaultSizeSystemCode(systems, countryCode));

  const activeSystem = systems.find((s) => s.code === active) || null;
  const selectedEntry =
    activeSystem && parsed?.code === activeSystem.code ? activeSystem.sizes.find((s) => s.label === parsed.label) : null;

  const customMm = Number(specs?.sizeCustomValue);
  const customValid = Number.isFinite(customMm) && customMm >= CUSTOM_RING_MM_MIN && customMm <= CUSTOM_RING_MM_MAX;

  // The size currently chosen, in mm, whichever toggle it came from.
  const currentMm = isCustom ? (customValid ? customMm : null) : parsed ? systems.find((s) => s.code === parsed.code)?.sizes.find((s) => s.label === parsed.label)?.mm ?? null : null;

  const selectStandard = (code, label) =>
    onChange({
      sizeMode: 'standard',
      sizeStandard: formatSizeSelectionLabel(systems, code, label),
      sizeCustomValue: '',
      sizeCustomUnit: 'mm',
    });

  const switchTo = (next) => {
    setBrowsing(next);
    if (next === CUSTOM) {
      onChange({
        sizeMode: 'custom',
        sizeStandard: '',
        sizeCustomValue: currentMm != null ? String(currentMm) : '',
        sizeCustomUnit: 'mm',
      });
      return;
    }
    const sys = systems.find((s) => s.code === next);
    const near = sys && currentMm != null ? nearestSize(sys, currentMm) : null;
    if (near) selectStandard(next, near.label);
    else onChange({ sizeMode: 'standard', sizeStandard: '', sizeCustomValue: '', sizeCustomUnit: 'mm' });
  };

  const setCustomCircumference = (text) =>
    onChange({ sizeMode: 'custom', sizeStandard: '', sizeCustomValue: text, sizeCustomUnit: 'mm' });

  const options = [...systems.map((s) => ({ value: s.code, label: s.label })), { value: CUSTOM, label: 'Custom' }];

  return (
    <div className="space-y-2">
      <Segmented options={options} value={active} onChange={switchTo} ariaLabel="Size system" />

      {activeSystem ? (
        <>
          <select
            value={selectedEntry?.label ?? ''}
            onChange={(e) => {
              const label = String(e.target.value || '');
              if (label) selectStandard(activeSystem.code, label);
              else onChange({ sizeMode: 'standard', sizeStandard: '' });
            }}
            className={fieldClass}
            aria-label={`${activeSystem.label} ring size`}
          >
            <option value="">Select {activeSystem.label} size</option>
            {activeSystem.sizes.map((s) => (
              <option key={s.label} value={s.label}>
                {activeSystem.label} {s.label} ({s.mm} mm)
              </option>
            ))}
          </select>
        </>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={specs?.sizeCustomValue || ''}
              onChange={(e) => setCustomCircumference(e.target.value)}
              className={`${fieldClass} pr-12`}
              placeholder="Inner circumference, e.g. 54.4"
              aria-label="Inner circumference in mm"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted">
              mm
            </span>
          </div>
          {!customValid && specs?.sizeCustomValue ? (
            <p className="text-[12px] text-red-600">
              Inner circumference is usually between {CUSTOM_RING_MM_MIN} and {CUSTOM_RING_MM_MAX} mm.
            </p>
          ) : (
            <p className="text-[12px] text-muted">
              Wrap a paper strip around your finger, mark where it meets, and measure the length in mm.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
