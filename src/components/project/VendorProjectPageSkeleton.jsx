import React from 'react';

export function SkeletonBar({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-pale ${className}`} aria-hidden />;
}

export function BidsTableSkeleton({ columns = 3 }) {
  const colCount = columns === 4 ? 4 : 3;
  return (
    <>
      <div className="md:hidden space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-pale bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              <SkeletonBar className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <SkeletonBar className="h-3 w-32" />
                <SkeletonBar className="h-3 w-24" />
              </div>
              <SkeletonBar className="h-4 w-16 shrink-0" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-pale bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left ${colCount === 4 ? 'min-w-[560px]' : 'min-w-[520px]'}`}>
            <thead>
              <tr className="border-b border-pale bg-walnut/[0.07]">
                <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Jeweller</th>
                <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Delivery</th>
                <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-muted">Bid amount</th>
                {colCount === 4 ? (
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-muted">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-pale/70 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
                      <SkeletonBar className="h-3 w-36" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonBar className="h-3 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonBar className="ml-auto h-3 w-16" />
                  </td>
                  {colCount === 4 ? (
                    <td className="px-4 py-3">
                      <SkeletonBar className="ml-auto h-8 w-20 rounded-xl" />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function LeftColumnSkeleton({ actionButtons = 2 }) {
  return (
    <div className="w-full shrink-0 lg:w-[400px] lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-pale bg-white shadow-sm">
        <SkeletonBar className="h-[280px] rounded-none sm:h-[340px]" />
        <div className="space-y-2 border-t border-pale p-4">
          {Array.from({ length: actionButtons }).map((_, i) => (
            <SkeletonBar key={i} className="h-11 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="mt-4 hidden space-y-4 lg:block">
        <div className="rounded-2xl border border-pale bg-white p-5">
          <SkeletonBar className="h-3 w-20" />
          <div className="mt-4 space-y-3">
            <SkeletonBar className="h-3 w-full" />
            <SkeletonBar className="h-3 w-[88%]" />
            <SkeletonBar className="h-3 w-[70%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-pale bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBar className="h-5 w-2/3" />
          <SkeletonBar className="h-3 w-1/2" />
          <SkeletonBar className="h-3 w-2/5" />
          <SkeletonBar className="h-3 w-1/3" />
        </div>
        <SkeletonBar className="h-7 w-24 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

/** Explore + Bids view: image, actions, details, bid table. */
export function VendorExploreProjectSkeleton({ withSearch = false, bidColumns = 3 }) {
  return (
    <div className="flex w-full flex-col items-start gap-5 lg:flex-row" aria-busy="true" aria-live="polite">
      <LeftColumnSkeleton actionButtons={2} />
      <div className="min-w-0 w-full flex-1 space-y-4">
        <DetailsCardSkeleton />
        {withSearch ? (
          <div className="flex w-full items-center gap-2 sm:gap-3">
            <SkeletonBar className="h-10 min-w-0 flex-1 rounded-xl" />
            <SkeletonBar className="h-10 w-16 shrink-0 rounded-xl" />
          </div>
        ) : null}
        <BidsTableSkeleton columns={bidColumns} />
      </div>
    </div>
  );
}

/** Assigned project manage view: image, details, payable, timeline. */
export function VendorManageProjectSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-5 lg:flex-row" aria-busy="true" aria-live="polite">
      <LeftColumnSkeleton actionButtons={1} />
      <div className="min-w-0 w-full flex-1 space-y-4">
        <DetailsCardSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-pale bg-white p-4 md:p-6">
            <SkeletonBar className="h-3 w-28" />
            <div className="mt-4 space-y-2">
              <SkeletonBar className="h-3 w-full" />
              <SkeletonBar className="h-3 w-[80%]" />
              <SkeletonBar className="h-3 w-[70%]" />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-pale bg-white p-4 md:p-6">
            <SkeletonBar className="h-3 w-32" />
            <div className="mt-4 space-y-2">
              <SkeletonBar className="h-10 w-full rounded-xl" />
              <SkeletonBar className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-pale bg-white p-4 md:p-6">
          <SkeletonBar className="h-3 w-36" />
          <div className="mt-5 space-y-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <SkeletonBar className="h-6 w-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <SkeletonBar className="h-3 w-40" />
                  <SkeletonBar className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
