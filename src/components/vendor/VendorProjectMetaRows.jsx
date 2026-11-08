import React, { useState } from 'react';
import { projectService } from '../../services/projectService';

export function isStoneQualityMetaKey(key) {
  const k = String(key || '').trim();
  return k === 'stoneQualityBracket' || k === 'stone_quality_bracket';
}

/** Manufacturers get the colour × clarity to source (see utils/stoneQualityBracket), not the customer's tier. */
export function diamondQualityMetaLabel() {
  return 'Diamond colour & clarity';
}

/** @deprecated Prefer `components/diamond/DiamondQualityGuideLink` */
export { default as DiamondQualityGuideLink } from '../diamond/DiamondQualityGuideLink';

/** Renders project meta rows; stone quality gets the colour & clarity label. */
export function VendorProjectMetaRows({ rows = [] }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return rows.map((r) => {
    const quality = isStoneQualityMetaKey(r?.key);
    const label = quality ? diamondQualityMetaLabel() : r?.label;
    return (
      <div key={r.key} className="space-y-1">
        <p className="text-[12px] text-muted font-semibold">{label}</p>
        <p className="text-[12px] text-ink font-extrabold break-words whitespace-pre-wrap">{r.value}</p>
      </div>
    );
  });
}

/** Downloads the manufacturing brief PDF so the details can go straight to the factory. */
function DownloadBriefButton({ projectId, projectTitle }) {
  const [state, setState] = useState('idle'); // idle | loading | error

  const download = async () => {
    if (state === 'loading') return;
    setState('loading');
    try {
      await projectService.downloadManufacturingBrief(projectId, { title: projectTitle });
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={state === 'loading'}
      title="Download these details as a PDF for your factory"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-pale bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-cream disabled:opacity-60"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {state === 'loading' ? 'Preparing…' : state === 'error' ? 'Retry download' : 'Download PDF'}
    </button>
  );
}

/** Stable Details card — keep outside page render so modal state survives parent re-renders (e.g. countdown). */
export default function VendorProjectMetaCard({ rows = [], title = 'Details', className = '', projectId = null, projectTitle = '' }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-pale bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</p>
        {projectId ? <DownloadBriefButton projectId={projectId} projectTitle={projectTitle} /> : null}
      </div>
      <div className="px-5 py-4 space-y-3">
        <VendorProjectMetaRows rows={rows} />
      </div>
    </div>
  );
}
