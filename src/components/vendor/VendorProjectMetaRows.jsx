import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DiamondClassificationPanel from './DiamondClassificationPanel';

export function isStoneQualityMetaKey(key) {
  const k = String(key || '').trim();
  return k === 'stoneQualityBracket' || k === 'stone_quality_bracket';
}

export function diamondQualityMetaLabel() {
  return 'Preferred Diamond Quality';
}

export function DiamondQualityGuideLink({ className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
            onMouseDown={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Diamond Quality Guidelines"
              className="w-full max-w-3xl max-h-[min(90dvh,720px)] overflow-y-auto bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-pale bg-white px-4 py-3 md:px-5">
                <p className="text-[14px] font-extrabold text-ink">Diamond Quality Guidelines</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 md:p-5">
                <DiamondClassificationPanel showTitle={false} className="border-0 shadow-none p-0 md:p-0" />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`mt-1 text-left text-[12px] font-semibold text-walnut underline underline-offset-2 decoration-walnut/50 hover:decoration-walnut cursor-pointer ${className}`}
      >
        Click here to see what diamond qualities mean
      </button>
      {modal}
    </>
  );
}

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
        {quality ? <DiamondQualityGuideLink /> : null}
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
