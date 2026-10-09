import React from 'react';
import DiamondQualityGuideLink from '../diamond/DiamondQualityGuideLink';

export function isStoneQualityMetaKey(key) {
  const k = String(key || '').trim();
  return k === 'stoneQualityBracket' || k === 'stone_quality_bracket';
}

export function diamondQualityMetaLabel() {
  return 'Preferred Diamond Quality';
}

/** @deprecated Prefer `components/diamond/DiamondQualityGuideLink` */
export { default as DiamondQualityGuideLink } from '../diamond/DiamondQualityGuideLink';

/** Renders project meta rows; stone quality gets Preferred Diamond Quality label + guide link. */
export function VendorProjectMetaRows({ rows = [] }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return rows.map((r) => {
    const quality = isStoneQualityMetaKey(r?.key);
    const label = quality ? diamondQualityMetaLabel() : r?.label;
    return (
      <div key={r.key} className="space-y-1">
        <p className="text-[12px] text-muted font-semibold">{label}</p>
        <p className="text-[12px] text-ink font-extrabold break-words whitespace-pre-wrap">{r.value}</p>
        {quality ? (
          <DiamondQualityGuideLink
            className="mt-1"
            label="Click here to see what diamond qualities mean"
          />
        ) : null}
      </div>
    );
  });
}

/** Stable Details card — keep outside page render so modal state survives parent re-renders (e.g. countdown). */
export default function VendorProjectMetaCard({ rows = [], title = 'Details', className = '' }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-pale bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-pale">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <VendorProjectMetaRows rows={rows} />
      </div>
    </div>
  );
}
