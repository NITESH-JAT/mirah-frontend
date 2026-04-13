import React from 'react';

export default function ListPaginationBar({
  currentPage,
  totalPages,
  totalItems,
  canPrev,
  canNext,
  onPrev,
  onNext,
}) {
  const totalNum = totalItems != null && totalItems !== '' ? Number(totalItems) : NaN;
  const totalLabel = Number.isFinite(totalNum) ? `${totalNum.toLocaleString('en-IN')} items` : null;

  return (
    <div className="box-border w-[calc(100%+2rem)] max-w-none shrink-0 -mx-4 border-t border-pale bg-cream px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] -mb-4 lg:-mx-8 lg:-mb-8 lg:w-[calc(100%+4rem)] lg:px-8">
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
