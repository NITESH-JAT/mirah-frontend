import React from 'react';

export default function ListPaginationBar({
  currentPage,
  totalPages,
  totalItems,
  canPrev,
  canNext,
  onPrev,
  onNext,
  fixedOnMobile = false,
}) {
  const totalNum = totalItems != null && totalItems !== '' ? Number(totalItems) : NaN;
  const totalLabel = Number.isFinite(totalNum) ? `${totalNum.toLocaleString('en-IN')} items` : null;

  // Default (in-flow, full-bleed) layout used across listing pages.
  const inFlowClasses =
    'box-border w-[calc(100%+2rem)] max-w-none shrink-0 -mx-4 bg-cream px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] -mb-4 lg:-mx-8 lg:-mb-8 lg:w-[calc(100%+4rem)] lg:px-8';

  // Same on desktop (md+), but pinned just above the mobile bottom nav on phones.
  const fixedMobileClasses =
    'box-border max-w-none shrink-0 bg-cream px-4 pt-3 pb-3 fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 w-auto border-t border-pale/60 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:static md:bottom-auto md:z-auto md:w-[calc(100%+2rem)] md:-mx-4 md:-mb-4 md:border-t-0 md:shadow-none md:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:-mx-8 lg:-mb-8 lg:w-[calc(100%+4rem)] lg:px-8';

  return (
    <div className={fixedOnMobile ? fixedMobileClasses : inFlowClasses}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[14px] md:text-[15px] text-mid">
          Page <span className="font-semibold text-ink">{currentPage}</span> of{' '}
          <span className="font-semibold text-ink">{totalPages}</span>
          {totalLabel ? (
            <>
              {' '}
              · {totalLabel}
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-6">
          {canPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="text-[14px] md:text-[15px] font-semibold text-mid hover:text-ink"
            >
              ← Prev
            </button>
          ) : null}
          {canNext ? (
            <button
              type="button"
              onClick={onNext}
              className="text-[14px] md:text-[15px] font-semibold text-mid hover:text-ink"
            >
              Next →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
